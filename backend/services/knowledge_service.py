"""
知识库核心服务 — 五大类 CRUD + 版本管理 + 统一搜索索引维护
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from backend.db import get_knowledge_db, HERMES_HOME


def _now() -> str:
    """ISO 8601 时间戳"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _gen_id(prefix: str) -> str:
    """生成唯一 ID"""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


class KnowledgeService:
    """知识库核心服务，管理规则/知识/经验/记忆的 CRUD 操作"""

    def __init__(self):
        self.conn = get_knowledge_db()

    # ============================================================
    # 通用方法
    # ============================================================

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        """将 sqlite3.Row 转为 dict，自动解析 JSON 字段"""
        d = dict(row)
        for key in ("tags", "references"):
            if key in d and isinstance(d[key], str):
                try:
                    d[key] = json.loads(d[key])
                except (json.JSONDecodeError, TypeError):
                    d[key] = []
        return d

    def _query(self, sql: str, params: tuple = ()) -> List[dict]:
        """执行查询并返回 dict 列表"""
        cursor = self.conn.execute(sql, params)
        return [self._row_to_dict(row) for row in cursor.fetchall()]

    def _query_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """执行查询并返回单个 dict"""
        cursor = self.conn.execute(sql, params)
        row = cursor.fetchone()
        return self._row_to_dict(row) if row else None

    def _save_version(self, target_type: str, target_id: str,
                      version: int, title: str, content: str,
                      changed_by: str = "ai", reason: str = ""):
        """保存版本历史"""
        self.conn.execute(
            """INSERT INTO version_history (id, target_type, target_id, version, title, content, changed_by, change_reason, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (_gen_id("ver"), target_type, target_id, version, title, content, changed_by, reason, _now())
        )

    def _update_unified_fts(self, target_type: str, ref_id: str,
                            title: str, content: str, tags: str,
                            category: str, created_at: str, is_active: bool):
        """更新统一搜索索引"""
        if is_active:
            # 检查是否已存在
            existing = self._query_one(
                "SELECT rowid FROM unified_fts_content WHERE type=? AND ref_id=?",
                (target_type, ref_id)
            )
            if existing:
                self.conn.execute(
                    "UPDATE unified_fts_content SET title=?, content=?, tags=?, category=? WHERE type=? AND ref_id=?",
                    (title, content, tags, category, target_type, ref_id)
                )
                # FTS 更新：先删后插
                self.conn.execute(
                    "INSERT INTO unified_fts(unified_fts, rowid, type, title, content, tags, category) VALUES ('delete', ?, ?, ?, ?, ?, ?)",
                    (existing["rowid"], target_type, title, content, tags, category)
                )
                self.conn.execute(
                    "INSERT INTO unified_fts(rowid, type, title, content, tags, category) VALUES (?, ?, ?, ?, ?, ?)",
                    (existing["rowid"], target_type, title, content, tags, category)
                )
            else:
                self.conn.execute(
                    "INSERT INTO unified_fts_content(type, ref_id, title, content, tags, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (target_type, ref_id, title, content, tags, category, created_at)
                )
                rowid = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]
                self.conn.execute(
                    "INSERT INTO unified_fts(rowid, type, title, content, tags, category) VALUES (?, ?, ?, ?, ?, ?)",
                    (rowid, target_type, title, content, tags, category)
                )
        else:
            self.conn.execute(
                "DELETE FROM unified_fts_content WHERE type=? AND ref_id=?",
                (target_type, ref_id)
            )

    def commit(self):
        """提交事务"""
        self.conn.commit()

    # ============================================================
    # 规则 CRUD
    # ============================================================

    def list_rules(self, category: str = None, is_active: bool = None,
                   tags: list = None, priority_min: int = None,
                   limit: int = 50, offset: int = 0) -> List[dict]:
        """列出规则"""
        sql = "SELECT * FROM rules WHERE 1=1"
        params = []
        if category:
            sql += " AND category = ?"
            params.append(category)
        if is_active is not None:
            sql += " AND is_active = ?"
            params.append(1 if is_active else 0)
        if priority_min is not None:
            sql += " AND priority >= ?"
            params.append(priority_min)
        if tags:
            for tag in tags:
                sql += " AND tags LIKE ?"
                params.append(f'%"{tag}"%')
        sql += " ORDER BY priority DESC, updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self._query(sql, tuple(params))

    def get_rule(self, rule_id: str) -> Optional[dict]:
        """获取规则详情"""
        return self._query_one("SELECT * FROM rules WHERE id = ?", (rule_id,))

    def create_rule(self, title: str, content: str, category: str = "general",
                    priority: int = 5, scope: str = "global", scope_value: str = "",
                    tags: list = None, source: str = "manual", source_ref: str = "",
                    created_by: str = "manual", review_id: str = None) -> dict:
        """创建规则"""
        rule_id = _gen_id("rule")
        now = _now()
        self.conn.execute(
            """INSERT INTO rules (id, title, content, category, priority, scope, scope_value,
               tags, source, source_ref, version, is_active, created_at, updated_at, created_by, review_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)""",
            (rule_id, title, content, category, priority, scope, scope_value,
             json.dumps(tags or [], ensure_ascii=False), source, source_ref,
             now, now, created_by, review_id)
        )
        self.commit()
        return self.get_rule(rule_id)

    def update_rule(self, rule_id: str, title: str = None, content: str = None,
                    category: str = None, priority: int = None, tags: list = None,
                    is_active: bool = None, changed_by: str = "ai") -> Optional[dict]:
        """更新规则（自动保存版本历史）"""
        rule = self.get_rule(rule_id)
        if not rule:
            return None
        # 保存旧版本
        self._save_version("rule", rule_id, rule["version"],
                          rule["title"], rule["content"], changed_by)
        # 构建更新
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if content is not None:
            updates.append("content = ?")
            params.append(content)
        if category is not None:
            updates.append("category = ?")
            params.append(category)
        if priority is not None:
            updates.append("priority = ?")
            params.append(priority)
        if tags is not None:
            updates.append("tags = ?")
            params.append(json.dumps(tags, ensure_ascii=False))
        if is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if is_active else 0)
        if not updates:
            return rule
        updates.append("version = version + 1")
        updates.append("updated_at = ?")
        params.append(_now())
        params.append(rule_id)
        self.conn.execute(f"UPDATE rules SET {', '.join(updates)} WHERE id = ?", params)
        self.commit()
        # 更新统一搜索索引
        updated = self.get_rule(rule_id)
        if updated:
            self._update_unified_fts("rule", rule_id, updated["title"],
                                    updated["content"], updated["tags"],
                                    updated["category"], updated["created_at"],
                                    bool(updated["is_active"]))
            self.commit()
        return updated

    def delete_rule(self, rule_id: str) -> bool:
        """删除规则（软删除）"""
        return self.update_rule(rule_id, is_active=False) is not None

    # ============================================================
    # 知识 CRUD
    # ============================================================

    def list_knowledge(self, category: str = None, is_active: bool = None,
                       tags: list = None, confidence_min: float = None,
                       limit: int = 50, offset: int = 0) -> List[dict]:
        """列出知识条目"""
        sql = "SELECT * FROM knowledge WHERE 1=1"
        params = []
        if category:
            sql += " AND category = ?"
            params.append(category)
        if is_active is not None:
            sql += " AND is_active = ?"
            params.append(1 if is_active else 0)
        if confidence_min is not None:
            sql += " AND confidence >= ?"
            params.append(confidence_min)
        if tags:
            for tag in tags:
                sql += " AND tags LIKE ?"
                params.append(f'%"{tag}"%')
        sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self._query(sql, tuple(params))

    def get_knowledge(self, knowledge_id: str) -> Optional[dict]:
        """获取知识详情"""
        result = self._query_one("SELECT * FROM knowledge WHERE id = ?", (knowledge_id,))
        if result:
            # 增加浏览计数
            self.conn.execute("UPDATE knowledge SET view_count = view_count + 1 WHERE id = ?", (knowledge_id,))
            self.conn.commit()
        return result

    def create_knowledge(self, title: str, content: str, summary: str = "",
                         category: str = "general", tags: list = None,
                         source: str = "manual", source_ref: str = "",
                         confidence: float = 0.8, references: list = None,
                         created_by: str = "manual", review_id: str = None) -> dict:
        """创建知识条目"""
        kn_id = _gen_id("kn")
        now = _now()
        self.conn.execute(
            """INSERT INTO knowledge (id, title, content, summary, category, tags,
               source, source_ref, confidence, references, version, is_active,
               view_count, created_at, updated_at, created_by, review_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?, ?, ?)""",
            (kn_id, title, content, summary, category,
             json.dumps(tags or [], ensure_ascii=False),
             source, source_ref, confidence,
             json.dumps(references or [], ensure_ascii=False),
             now, now, created_by, review_id)
        )
        self.commit()
        return self.get_knowledge(kn_id)

    def update_knowledge(self, knowledge_id: str, title: str = None, content: str = None,
                         summary: str = None, category: str = None, tags: list = None,
                         confidence: float = None, is_active: bool = None,
                         changed_by: str = "ai") -> Optional[dict]:
        """更新知识条目"""
        kn = self.get_knowledge(knowledge_id)
        if not kn:
            return None
        self._save_version("knowledge", knowledge_id, kn["version"],
                          kn["title"], kn["content"], changed_by)
        updates, params = [], []
        if title is not None:
            updates.append("title = ?"); params.append(title)
        if content is not None:
            updates.append("content = ?"); params.append(content)
        if summary is not None:
            updates.append("summary = ?"); params.append(summary)
        if category is not None:
            updates.append("category = ?"); params.append(category)
        if tags is not None:
            updates.append("tags = ?"); params.append(json.dumps(tags, ensure_ascii=False))
        if confidence is not None:
            updates.append("confidence = ?"); params.append(confidence)
        if is_active is not None:
            updates.append("is_active = ?"); params.append(1 if is_active else 0)
        if not updates:
            return kn
        updates.extend(["version = version + 1", "updated_at = ?"])
        params.extend([_now(), knowledge_id])
        self.conn.execute(f"UPDATE knowledge SET {', '.join(updates)} WHERE id = ?", params)
        self.commit()
        updated = self.get_knowledge(knowledge_id)
        if updated:
            self._update_unified_fts("knowledge", knowledge_id, updated["title"],
                                    updated["content"], updated["tags"],
                                    updated["category"], updated["created_at"],
                                    bool(updated["is_active"]))
            self.commit()
        return updated

    def delete_knowledge(self, knowledge_id: str) -> bool:
        return self.update_knowledge(knowledge_id, is_active=False) is not None

    # ============================================================
    # 经验 CRUD
    # ============================================================

    def list_experiences(self, category: str = None, is_active: bool = None,
                         is_resolved: bool = None, severity: str = None,
                         tool_name: str = None, tags: list = None,
                         limit: int = 50, offset: int = 0) -> List[dict]:
        """列出经验条目"""
        sql = "SELECT * FROM experiences WHERE 1=1"
        params = []
        if category:
            sql += " AND category = ?"; params.append(category)
        if is_active is not None:
            sql += " AND is_active = ?"; params.append(1 if is_active else 0)
        if is_resolved is not None:
            sql += " AND is_resolved = ?"; params.append(1 if is_resolved else 0)
        if severity:
            sql += " AND severity = ?"; params.append(severity)
        if tool_name:
            sql += " AND tool_name = ?"; params.append(tool_name)
        if tags:
            for tag in tags:
                sql += " AND tags LIKE ?"; params.append(f'%"{tag}"%')
        sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self._query(sql, tuple(params))

    def get_experience(self, exp_id: str) -> Optional[dict]:
        return self._query_one("SELECT * FROM experiences WHERE id = ?", (exp_id,))

    def create_experience(self, title: str, content: str, category: str = "best_practice",
                          context: str = "", tool_name: str = "", error_type: str = "",
                          severity: str = "medium", tags: list = None,
                          source: str = "ai_learned", source_ref: str = "",
                          created_by: str = "ai", review_id: str = None) -> dict:
        exp_id = _gen_id("exp")
        now = _now()
        self.conn.execute(
            """INSERT INTO experiences (id, title, content, category, context, tool_name,
               error_type, severity, is_resolved, occurrence_count, last_seen,
               tags, source, source_ref, version, is_active, created_at, updated_at, created_by, review_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)""",
            (exp_id, title, content, category, context, tool_name, error_type, severity,
             now, json.dumps(tags or [], ensure_ascii=False), source, source_ref,
             now, now, created_by, review_id)
        )
        self.commit()
        return self.get_experience(exp_id)

    def update_experience(self, exp_id: str, title: str = None, content: str = None,
                          category: str = None, is_resolved: bool = None,
                          tags: list = None, is_active: bool = None,
                          changed_by: str = "ai") -> Optional[dict]:
        exp = self.get_experience(exp_id)
        if not exp:
            return None
        self._save_version("experience", exp_id, exp["version"],
                          exp["title"], exp["content"], changed_by)
        updates, params = [], []
        if title is not None:
            updates.append("title = ?"); params.append(title)
        if content is not None:
            updates.append("content = ?"); params.append(content)
        if category is not None:
            updates.append("category = ?"); params.append(category)
        if is_resolved is not None:
            updates.append("is_resolved = ?"); params.append(1 if is_resolved else 0)
        if tags is not None:
            updates.append("tags = ?"); params.append(json.dumps(tags, ensure_ascii=False))
        if is_active is not None:
            updates.append("is_active = ?"); params.append(1 if is_active else 0)
        if not updates:
            return exp
        updates.extend(["version = version + 1", "updated_at = ?"])
        params.extend([_now(), exp_id])
        self.conn.execute(f"UPDATE experiences SET {', '.join(updates)} WHERE id = ?", params)
        self.commit()
        updated = self.get_experience(exp_id)
        if updated:
            self._update_unified_fts("experience", exp_id, updated["title"],
                                    updated["content"], updated["tags"],
                                    updated["category"], updated["created_at"],
                                    bool(updated["is_active"]))
            self.commit()
        return updated

    def resolve_experience(self, exp_id: str, changed_by: str = "ai") -> Optional[dict]:
        """标记经验为已解决"""
        return self.update_experience(exp_id, is_resolved=True, changed_by=changed_by)

    def delete_experience(self, exp_id: str) -> bool:
        return self.update_experience(exp_id, is_active=False) is not None

    def increment_experience_occurrence(self, exp_id: str):
        """增加经验出现次数"""
        now = _now()
        self.conn.execute(
            "UPDATE experiences SET occurrence_count = occurrence_count + 1, last_seen = ? WHERE id = ?",
            (now, exp_id)
        )
        self.commit()

    # ============================================================
    # 记忆 CRUD
    # ============================================================

    def list_memories(self, category: str = None, is_active: bool = None,
                      importance_min: int = None, tags: list = None,
                      include_expired: bool = False,
                      limit: int = 50, offset: int = 0) -> List[dict]:
        """列出记忆条目"""
        sql = "SELECT * FROM memories WHERE 1=1"
        params = []
        if category:
            sql += " AND category = ?"; params.append(category)
        if is_active is not None:
            sql += " AND is_active = ?"; params.append(1 if is_active else 0)
        if not include_expired:
            sql += " AND (expires_at = '' OR expires_at > ?)"
            params.append(_now())
        if importance_min is not None:
            sql += " AND importance >= ?"; params.append(importance_min)
        if tags:
            for tag in tags:
                sql += " AND tags LIKE ?"; params.append(f'%"{tag}"%')
        sql += " ORDER BY importance DESC, updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self._query(sql, tuple(params))

    def get_memory(self, mem_id: str) -> Optional[dict]:
        mem = self._query_one("SELECT * FROM memories WHERE id = ?", (mem_id,))
        if mem:
            # 更新访问计数
            self.conn.execute(
                "UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?",
                (_now(), mem_id)
            )
            self.conn.commit()
        return mem

    def create_memory(self, content: str, category: str = "agent_memory",
                      title: str = "", importance: int = 5,
                      expires_at: str = "", tags: list = None,
                      source: str = "ai", source_ref: str = "",
                      created_by: str = "ai", review_id: str = None) -> dict:
        mem_id = _gen_id("mem")
        now = _now()
        if not title:
            title = content[:50].replace("\n", " ") + ("..." if len(content) > 50 else "")
        self.conn.execute(
            """INSERT INTO memories (id, category, title, content, importance,
               access_count, last_accessed, expires_at, tags, source, source_ref,
               version, is_active, created_at, updated_at, created_by, review_id)
               VALUES (?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)""",
            (mem_id, category, title, content, importance, expires_at,
             json.dumps(tags or [], ensure_ascii=False), source, source_ref,
             now, now, created_by, review_id)
        )
        self.commit()
        return self.get_memory(mem_id)

    def update_memory(self, mem_id: str, content: str = None, category: str = None,
                      title: str = None, importance: int = None, tags: list = None,
                      is_active: bool = None, expires_at: str = None,
                      changed_by: str = "ai") -> Optional[dict]:
        mem = self.get_memory(mem_id)
        if not mem:
            return None
        self._save_version("memory", mem_id, mem["version"],
                          mem["title"], mem["content"], changed_by)
        updates, params = [], []
        if content is not None:
            updates.append("content = ?"); params.append(content)
        if category is not None:
            updates.append("category = ?"); params.append(category)
        if title is not None:
            updates.append("title = ?"); params.append(title)
        if importance is not None:
            updates.append("importance = ?"); params.append(importance)
        if tags is not None:
            updates.append("tags = ?"); params.append(json.dumps(tags, ensure_ascii=False))
        if is_active is not None:
            updates.append("is_active = ?"); params.append(1 if is_active else 0)
        if expires_at is not None:
            updates.append("expires_at = ?"); params.append(expires_at)
        if not updates:
            return mem
        updates.extend(["version = version + 1", "updated_at = ?"])
        params.extend([_now(), mem_id])
        self.conn.execute(f"UPDATE memories SET {', '.join(updates)} WHERE id = ?", params)
        self.commit()
        updated = self.get_memory(mem_id)
        if updated:
            self._update_unified_fts("memory", mem_id, updated["title"],
                                    updated["content"], updated["tags"],
                                    updated["category"], updated["created_at"],
                                    bool(updated["is_active"]))
            self.commit()
        return updated

    def forget_memory(self, mem_id: str) -> bool:
        """删除/归档记忆"""
        return self.update_memory(mem_id, is_active=False) is not None

    # ============================================================
    # 统计
    # ============================================================

    def get_overview_stats(self) -> dict:
        """获取知识库概览统计"""
        return {
            "rules_count": self._query_one("SELECT COUNT(*) as c FROM rules WHERE is_active=1")["c"],
            "knowledge_count": self._query_one("SELECT COUNT(*) as c FROM knowledge WHERE is_active=1")["c"],
            "experiences_count": self._query_one("SELECT COUNT(*) as c FROM experiences WHERE is_active=1")["c"],
            "memories_count": self._query_one("SELECT COUNT(*) as c FROM memories WHERE is_active=1")["c"],
            "reviews_pending": self._query_one("SELECT COUNT(*) as c FROM reviews WHERE status='pending'")["c"],
            "total_items": 0  # 下面计算
        }
