"""上下文预算服务 — 根据 token 预算从知识库中选取最重要的内容注入 AI 上下文"""

import sqlite3
from typing import List, Dict, Any, Optional
from backend.db import get_knowledge_db

class ContextBudgetService:
    def __init__(self):
        self.conn = get_knowledge_db()
    def get_budget(self) -> dict:
        row = self.conn.execute("SELECT * FROM context_budget WHERE id = 1").fetchone()
        if not row: return self._default_budget()
        return dict(row)
    def update_budget(self, **kwargs) -> dict:
        sets, params = [], []
        for k, v in kwargs.items():
            if v is not None: sets.append(f"{k} = ?"); params.append(v)
        if sets:
            sets.append("updated_at = datetime('now')"); params.append(1)
            self.conn.execute(f"UPDATE context_budget SET {', '.join(sets)} WHERE id = ?", params)
            self.conn.commit()
        return self.get_budget()
    def build_context(self, session_id: str = "", query: str = "", max_tokens: int = None, agent_id: str = "") -> str:
        budget = self.get_budget()
        total = max_tokens or budget["total_budget"]
        role_overrides = self._get_role_budget_overrides(agent_id)
        rules_pct = role_overrides.get("rules_pct", budget["rules_pct"])
        knowledge_pct = role_overrides.get("knowledge_pct", budget["knowledge_pct"])
        exp_pct = role_overrides.get("experience_pct", budget["experience_pct"])
        mem_pct = role_overrides.get("memory_pct", budget["memory_pct"])
        char_budget = total * 2
        sections = []
        rules = self._get_top_content("rules", "priority DESC, updated_at DESC", int(char_budget * rules_pct / 100))
        if rules: sections.append(f"## 📋 当前生效规则\n\n{rules}")
        knowledge = self._get_top_content("knowledge", "confidence DESC, updated_at DESC", int(char_budget * knowledge_pct / 100))
        if knowledge: sections.append(f"## 📚 相关知识\n\n{knowledge}")
        experiences = self._get_top_content("experiences", "is_resolved ASC, severity DESC, updated_at DESC", int(char_budget * exp_pct / 100), extra_where="AND is_resolved = 0")
        if experiences: sections.append(f"## 💡 相关经验（未解决）\n\n{experiences}")
        memories = self._get_top_content("memories", "importance DESC, updated_at DESC", int(char_budget * mem_pct / 100), extra_where="AND (expires_at = '' OR expires_at > datetime('now'))")
        if memories: sections.append(f"## 🧠 相关记忆\n\n{memories}")
        if not sections: return ""
        return f"<!-- 知识库上下文（预算 {total} tokens）-->\n\n" + "\n\n".join(sections)
    def _get_top_content(self, table: str, order_by: str, max_chars: int, extra_where: str = "") -> str:
        sql = f"SELECT title, content FROM {table} WHERE is_active = 1 {extra_where} ORDER BY {order_by}"
        cursor = self.conn.execute(sql)
        result_parts, total_chars = [], 0
        for row in cursor.fetchall():
            title, content = row["title"], row["content"]
            entry = f"### {title}\n\n{content}"
            if total_chars + len(entry) > max_chars:
                remaining = max_chars - total_chars
                if remaining > 50:
                    truncated = entry[:remaining]
                    last_nl = truncated.rfind("\n")
                    if last_nl > remaining * 0.5: truncated = truncated[:last_nl]
                    result_parts.append(truncated + "\n\n...")
                break
            result_parts.append(entry)
            total_chars += len(entry)
        return "\n\n---\n\n".join(result_parts)
    def _default_budget(self) -> dict:
        return {"id": 1, "total_budget": 4000, "rules_pct": 15, "knowledge_pct": 25, "experience_pct": 15, "memory_pct": 20, "session_pct": 25, "updated_at": ""}
    def _get_role_budget_overrides(self, agent_id: str) -> dict:
        if not agent_id: return {}
        ROLE_BUDGETS = {
            "coder": {"rules_pct": 20, "knowledge_pct": 20, "experience_pct": 20, "memory_pct": 10},
            "researcher": {"rules_pct": 10, "knowledge_pct": 35, "experience_pct": 10, "memory_pct": 15},
            "general": {"rules_pct": 15, "knowledge_pct": 25, "experience_pct": 15, "memory_pct": 20},
        }
        try:
            from backend.services.agent_identity import agent_identity_manager
            agent = agent_identity_manager.get_agent(agent_id)
            if agent: return ROLE_BUDGETS.get(agent.get("role", "general"), {})
        except Exception: pass
        return {}

def inject_knowledge_context(session_id: str = "", query: str = "") -> str:
    svc = ContextBudgetService()
    return svc.build_context(session_id=session_id, query=query)