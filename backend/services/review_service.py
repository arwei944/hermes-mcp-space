"""
审核队列服务 — 管理 AI 写入操作的审核流程
"""

import json
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from backend.db import get_knowledge_db
from backend.services.knowledge_service import _now, _gen_id, KnowledgeService


class ReviewService:
    """审核队列服务"""

    def __init__(self):
        self.conn = get_knowledge_db()
        self.knowledge_svc = KnowledgeService()

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        return dict(row)

    def _query(self, sql: str, params: tuple = ()) -> List[dict]:
        cursor = self.conn.execute(sql, params)
        return [self._row_to_dict(row) for row in cursor.fetchall()]

    def _query_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        cursor = self.conn.execute(sql, params)
        row = cursor.fetchone()
        return self._row_to_dict(row) if row else None

    def submit_review(self, target_type: str, action: str, title: str,
                      content: str, old_content: str = "",
                      reason: str = "", confidence: float = 0.8,
                      priority: str = "normal",
                      session_id: str = "", tool_call: str = "",
                      context: str = "") -> dict:
        """
        提交审核请求
        AI 调用写入工具时，不直接写入目标表，而是创建审核记录

        Args:
            target_type: rule/knowledge/experience/memory
            action: create/update/delete/resolve
            title: 变更标题
            content: 变更内容
            old_content: 变更前内容（update/delete 时提供）
            reason: AI 给出的变更理由
            confidence: AI 置信度 0-1
            priority: urgent/normal/low
            session_id: 触发会话 ID
            tool_call: MCP 工具调用 JSON
            context: AI 上下文说明

        Returns:
            审核记录 dict
        """
        review_id = _gen_id("rev")
        now = _now()
        # 默认 7 天后过期
        expires = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

        self.conn.execute(
            """INSERT INTO reviews (id, target_type, target_id, action, title, content,
               old_content, reason, confidence, priority, status, created_at, expires_at,
               session_id, tool_call, context)
               VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)""",
            (review_id, target_type, action, title, content, old_content,
             reason, confidence, priority, now, expires,
             session_id, tool_call, context)
        )
        self.conn.commit()
        return self.get_review(review_id)

    def get_review(self, review_id: str) -> Optional[dict]:
        return self._query_one("SELECT * FROM reviews WHERE id = ?", (review_id,))

    def list_reviews(self, status: str = None, target_type: str = None,
                     limit: int = 50, offset: int = 0) -> List[dict]:
        sql = "SELECT * FROM reviews WHERE 1=1"
        params = []
        if status:
            sql += " AND status = ?"; params.append(status)
        if target_type:
            sql += " AND target_type = ?"; params.append(target_type)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self._query(sql, tuple(params))

    def get_review_stats(self) -> dict:
        """获取审核统计"""
        pending = self._query_one("SELECT COUNT(*) as c FROM reviews WHERE status='pending'")["c"]
        today_approved = self._query_one(
            "SELECT COUNT(*) as c FROM reviews WHERE status='approved' AND reviewed_at >= date('now')"
        )["c"]
        today_rejected = self._query_one(
            "SELECT COUNT(*) as c FROM reviews WHERE status='rejected' AND reviewed_at >= date('now')"
        )["c"]
        total = self._query_one("SELECT COUNT(*) as c FROM reviews")["c"]
        return {
            "pending": pending,
            "today_approved": today_approved,
            "today_rejected": today_rejected,
            "today_total": today_approved + today_rejected,
            "approval_rate": round(today_approved / max(today_approved + today_rejected, 1), 2),
            "total": total
        }

    def approve_review(self, review_id: str, reviewed_by: str = "admin",
                       review_note: str = "") -> Optional[dict]:
        """
        通过审核 — 将变更写入目标表

        工作流：
        1. 读取审核记录
        2. 根据 action 执行对应的 CRUD 操作
        3. 将 target_id 写回审核记录
        4. 更新审核状态为 approved
        """
        review = self.get_review(review_id)
        if not review or review["status"] != "pending":
            return None

        now = _now()
        target_id = ""

        try:
            if review["action"] == "create":
                target_id = self._execute_create(review)
            elif review["action"] == "update":
                target_id = self._execute_update(review)
            elif review["action"] == "delete":
                target_id = self._execute_delete(review)
            elif review["action"] == "resolve":
                target_id = self._execute_resolve(review)
        except Exception as e:
            # 审核通过但执行失败，记录错误
            review_note = f"执行失败: {str(e)} | {review_note}"

        self.conn.execute(
            "UPDATE reviews SET status='approved', target_id=?, reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?",
            (target_id, reviewed_by, now, review_note, review_id)
        )
        self.conn.commit()

        # 触发 SSE 事件（由路由层处理）
        return self.get_review(review_id)

    def reject_review(self, review_id: str, reviewed_by: str = "admin",
                      review_note: str = "") -> Optional[dict]:
        """拒绝审核"""
        review = self.get_review(review_id)
        if not review or review["status"] != "pending":
            return None
        now = _now()
        self.conn.execute(
            "UPDATE reviews SET status='rejected', reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?",
            (reviewed_by, now, review_note, review_id)
        )
        self.conn.commit()
        return self.get_review(review_id)

    def modify_and_approve(self, review_id: str, modified_content: str,
                           reviewed_by: str = "admin",
                           review_note: str = "") -> Optional[dict]:
        """修改内容后通过审核"""
        review = self.get_review(review_id)
        if not review or review["status"] != "pending":
            return None
        # 更新审核记录中的内容
        self.conn.execute(
            "UPDATE reviews SET content=? WHERE id=?",
            (modified_content, review_id)
        )
        self.conn.commit()
        # 然后执行通过
        return self.approve_review(review_id, reviewed_by,
                                   f"修改后通过 | {review_note}")

    def batch_approve(self, review_ids: List[str], reviewed_by: str = "admin") -> dict:
        """批量通过审核"""
        results = {"approved": 0, "failed": 0, "errors": []}
        for rid in review_ids:
            try:
                result = self.approve_review(rid, reviewed_by)
                if result and result["status"] == "approved":
                    results["approved"] += 1
                else:
                    results["failed"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"id": rid, "error": str(e)})
        return results

    def batch_reject(self, review_ids: List[str], reviewed_by: str = "admin") -> dict:
        """批量拒绝审核"""
        results = {"rejected": 0, "failed": 0}
        for rid in review_ids:
            try:
                result = self.reject_review(rid, reviewed_by)
                if result and result["status"] == "rejected":
                    results["rejected"] += 1
                else:
                    results["failed"] += 1
            except Exception:
                results["failed"] += 1
        return results

    def expire_old_reviews(self):
        """过期自动清理（由 Cron 调用）"""
        self.conn.execute(
            "UPDATE reviews SET status='expired' WHERE status='pending' AND expires_at < ?",
            (_now(),)
        )
        self.conn.commit()

    # ============================================================
    # 内部执行方法
    # ============================================================

    def _execute_create(self, review: dict) -> str:
        """执行创建操作"""
        content = review["content"]
        # 尝试解析 JSON 格式的 content（AI 可能传入 JSON）
        try:
            data = json.loads(content)
            title = data.get("title", review["title"])
            body = data.get("content", content)
            tags = data.get("tags", [])
            category = data.get("category", "general")
        except (json.JSONDecodeError, TypeError):
            title = review["title"]
            body = content
            tags = []
            category = "general"

        target_type = review["target_type"]
        if target_type == "rule":
            result = self.knowledge_svc.create_rule(
                title=title, content=body, tags=tags, category=category,
                source="ai", created_by="ai", review_id=review["id"]
            )
        elif target_type == "knowledge":
            result = self.knowledge_svc.create_knowledge(
                title=title, content=body, tags=tags, category=category,
                source="ai_extracted", created_by="ai", review_id=review["id"]
            )
        elif target_type == "experience":
            result = self.knowledge_svc.create_experience(
                title=title, content=body, tags=tags, category=category,
                source="ai_learned", created_by="ai", review_id=review["id"]
            )
        elif target_type == "memory":
            result = self.knowledge_svc.create_memory(
                content=body, title=title, tags=tags, category=category or "agent_memory",
                source="ai", created_by="ai", review_id=review["id"]
            )
        else:
            raise ValueError(f"Unknown target type: {target_type}")

        return result["id"]

    def _execute_update(self, review: dict) -> str:
        """执行更新操作"""
        target_id = review.get("target_id", "")
        if not target_id:
            raise ValueError("Update requires target_id")
        # 从 content 中解析要更新的字段
        try:
            data = json.loads(review["content"])
        except (json.JSONDecodeError, TypeError):
            data = {"content": review["content"]}

        target_type = review["target_type"]
        if target_type == "rule":
            result = self.knowledge_svc.update_rule(target_id, changed_by="ai", **data)
        elif target_type == "knowledge":
            result = self.knowledge_svc.update_knowledge(target_id, changed_by="ai", **data)
        elif target_type == "experience":
            result = self.knowledge_svc.update_experience(target_id, changed_by="ai", **data)
        elif target_type == "memory":
            result = self.knowledge_svc.update_memory(target_id, changed_by="ai", **data)
        else:
            raise ValueError(f"Unknown target type: {target_type}")

        return result["id"] if result else ""

    def _execute_delete(self, review: dict) -> str:
        """执行删除操作"""
        target_id = review.get("target_id", "")
        if not target_id:
            raise ValueError("Delete requires target_id")
        target_type = review["target_type"]
        if target_type == "rule":
            self.knowledge_svc.delete_rule(target_id)
        elif target_type == "knowledge":
            self.knowledge_svc.delete_knowledge(target_id)
        elif target_type == "experience":
            self.knowledge_svc.delete_experience(target_id)
        elif target_type == "memory":
            self.knowledge_svc.forget_memory(target_id)
        return target_id

    def _execute_resolve(self, review: dict) -> str:
        """执行解决操作（仅经验类）"""
        target_id = review.get("target_id", "")
        if not target_id:
            raise ValueError("Resolve requires target_id")
        result = self.knowledge_svc.resolve_experience(target_id, changed_by="ai")
        return result["id"] if result else ""
