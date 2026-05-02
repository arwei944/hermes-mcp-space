"""
上下文预算服务 — 根据 token 预算从知识库中选取最重要的内容注入 AI 上下文
"""

import sqlite3
from typing import List, Dict, Any, Optional

from backend.db import get_knowledge_db


class ContextBudgetService:
    """上下文预算管理服务"""

    def __init__(self):
        self.conn = get_knowledge_db()

    def get_budget(self) -> dict:
        """获取当前上下文预算配置"""
        row = self.conn.execute(
            "SELECT * FROM context_budget WHERE id = 1"
        ).fetchone()
        if not row:
            return self._default_budget()
        return dict(row)

    def update_budget(self, rules_pct: int = None, knowledge_pct: int = None,
                      experience_pct: int = None, memory_pct: int = None,
                      session_pct: int = None, total_budget: int = None) -> dict:
        """更新预算配置"""
        sets, params = [], []
        if total_budget is not None:
            sets.append("total_budget = ?"); params.append(total_budget)
        if rules_pct is not None:
            sets.append("rules_pct = ?"); params.append(rules_pct)
        if knowledge_pct is not None:
            sets.append("knowledge_pct = ?"); params.append(knowledge_pct)
        if experience_pct is not None:
            sets.append("experience_pct = ?"); params.append(experience_pct)
        if memory_pct is not None:
            sets.append("memory_pct = ?"); params.append(memory_pct)
        if session_pct is not None:
            sets.append("session_pct = ?"); params.append(session_pct)
        if sets:
            sets.append("updated_at = datetime('now')")
            params.append(1)
            self.conn.execute(
                f"UPDATE context_budget SET {', '.join(sets)} WHERE id = ?",
                params
            )
            self.conn.commit()
        return self.get_budget()

    def build_context(self, session_id: str = "", query: str = "",
                      max_tokens: int = None) -> str:
        """
        构建注入 AI 上下文的知识内容

        策略：
        1. 根据预算比例计算各类的 token 分配
        2. 按 importance/priority/access_count/updated_at 综合排序
        3. 截取到预算限制内
        4. 格式化为 Markdown

        Args:
            session_id: 当前会话 ID（用于个性化）
            query: 当前查询（用于相关性排序）
            max_tokens: 最大 token 数（覆盖预算配置）

        Returns:
            Markdown 格式的上下文字符串
        """
        budget = self.get_budget()
        total = max_tokens or budget["total_budget"]

        # 计算各类 token 分配（1 token ≈ 2 字符，保守估计）
        char_budget = total * 2
        rules_chars = int(char_budget * budget["rules_pct"] / 100)
        knowledge_chars = int(char_budget * budget["knowledge_pct"] / 100)
        exp_chars = int(char_budget * budget["experience_pct"] / 100)
        mem_chars = int(char_budget * budget["memory_pct"] / 100)

        sections = []

        # 1. 规则（按优先级排序）
        rules = self._get_top_content("rules", "priority DESC, updated_at DESC", rules_chars)
        if rules:
            sections.append(f"## 📋 当前生效规则\n\n{rules}")

        # 2. 知识（按置信度 + 更新时间排序）
        knowledge = self._get_top_content("knowledge", "confidence DESC, updated_at DESC", knowledge_chars)
        if knowledge:
            sections.append(f"## 📚 相关知识\n\n{knowledge}")

        # 3. 经验（未解决的优先）
        experiences = self._get_top_content(
            "experiences",
            "is_resolved ASC, severity DESC, updated_at DESC",
            exp_chars,
            extra_where="AND is_resolved = 0"
        )
        if experiences:
            sections.append(f"## 💡 相关经验（未解决）\n\n{experiences}")

        # 4. 记忆（按重要性排序）
        memories = self._get_top_content(
            "memories",
            "importance DESC, updated_at DESC",
            mem_chars,
            extra_where="AND (expires_at = '' OR expires_at > datetime('now'))"
        )
        if memories:
            sections.append(f"## 🧠 相关记忆\n\n{memories}")

        if not sections:
            return ""

        header = f"<!-- 知识库上下文（预算 {total} tokens）-->\n"
        return header + "\n\n".join(sections)

    def _get_top_content(self, table: str, order_by: str,
                         max_chars: int, extra_where: str = "") -> str:
        """
        从指定表中获取最相关的内容，截取到字符限制内

        Args:
            table: 表名
            order_by: 排序方式
            max_chars: 最大字符数
            extra_where: 额外 WHERE 条件

        Returns:
            格式化的 Markdown 字符串
        """
        sql = f"SELECT title, content FROM {table} WHERE is_active = 1 {extra_where} ORDER BY {order_by}"
        cursor = self.conn.execute(sql)

        result_parts = []
        total_chars = 0

        for row in cursor.fetchall():
            title = row["title"]
            content = row["content"]
            entry = f"### {title}\n\n{content}"
            entry_chars = len(entry)

            if total_chars + entry_chars > max_chars:
                # 截取剩余空间
                remaining = max_chars - total_chars
                if remaining > 50:  # 至少 50 字符才有意义
                    truncated = entry[:remaining]
                    # 确保从完整行截断
                    last_newline = truncated.rfind("\n")
                    if last_newline > remaining * 0.5:
                        truncated = truncated[:last_newline]
                    result_parts.append(truncated + "\n\n...")
                break

            result_parts.append(entry)
            total_chars += entry_chars

        return "\n\n---\n\n".join(result_parts)

    def _default_budget(self) -> dict:
        return {
            "id": 1, "total_budget": 4000,
            "rules_pct": 15, "knowledge_pct": 25,
            "experience_pct": 15, "memory_pct": 20,
            "session_pct": 25, "updated_at": ""
        }


# ============================================================
# MCP 集成：在会话启动时自动注入上下文
# ============================================================

def inject_knowledge_context(session_id: str = "", query: str = "") -> str:
    """
    MCP 工具层调用的入口函数
    在 AI 开始新会话时调用，返回要注入系统提示的知识上下文

    Usage:
        # 在 mcp_server.py 的 handle_tool_call 中
        if tool_name in KNOWLEDGE_TOOLS:
            context = inject_knowledge_context(session_id)
            # 将 context 附加到 AI 的系统提示中
    """
    svc = ContextBudgetService()
    return svc.build_context(session_id=session_id, query=query)
