# -*- coding: utf-8 -*-
"""上下文预算服务 — 根据 token 预算从知识库中选取最重要的内容注入 AI 上下文

v2: 扩展规则分类体系，支持按分类精细分配预算
"""

import sqlite3
import logging
from typing import List, Dict, Any, Optional
from backend.db import get_knowledge_db

logger = logging.getLogger("hermes-mcp")

# ============================================================
# 规则分类体系 v2 — 精细化分类
# ============================================================
RULE_CATEGORIES = {
    # --- 安全类（最高优先级，始终注入） ---
    "safety": {
        "label": "安全规则",
        "icon": "🛡️",
        "description": "涉及安全、隐私、数据保护的硬性规则",
        "budget_weight": 1.5,  # 预算权重倍数
    },
    "output_control": {
        "label": "输出控制",
        "icon": "📝",
        "description": "控制输出格式、语言、风格的规则",
        "budget_weight": 1.0,
    },
    # --- 行为类 ---
    "behavior": {
        "label": "行为规范",
        "icon": "🎭",
        "description": "Agent 行为准则、交互礼仪、沟通方式",
        "budget_weight": 1.2,
    },
    "workflow": {
        "label": "工作流程",
        "icon": "🔄",
        "description": "标准操作流程、步骤规范",
        "budget_weight": 0.8,
    },
    # --- 知识类 ---
    "domain": {
        "label": "领域知识",
        "icon": "📖",
        "description": "特定领域的专业知识和约束",
        "budget_weight": 0.7,
    },
    "coding": {
        "label": "编码规范",
        "icon": "💻",
        "description": "代码风格、编程最佳实践",
        "budget_weight": 0.9,
    },
    # --- 通用 ---
    "general": {
        "label": "通用规则",
        "icon": "📋",
        "description": "不属于以上分类的通用规则",
        "budget_weight": 0.5,
    },
    "priority": {
        "label": "优先规则",
        "icon": "⭐",
        "description": "用户明确标记的高优先级规则",
        "budget_weight": 1.3,
    },
}

# 向后兼容：旧分类名映射到新分类
CATEGORY_ALIAS_MAP = {
    "format": "output_control",
    "safety_critical": "safety",
    "data_handling": "safety",
    "best_practice": "coding",
}


def resolve_category(category: str) -> str:
    """将旧分类名映射到新分类名"""
    return CATEGORY_ALIAS_MAP.get(category, category)


class ContextBudgetService:
    def __init__(self):
        self.conn = get_knowledge_db()

    def get_budget(self) -> dict:
        row = self.conn.execute("SELECT * FROM context_budget WHERE id = 1").fetchone()
        if not row:
            return self._default_budget()
        return dict(row)

    def update_budget(self, **kwargs) -> dict:
        sets, params = [], []
        for k, v in kwargs.items():
            if v is not None:
                sets.append(f"{k} = ?")
                params.append(v)
        if sets:
            sets.append("updated_at = datetime('now')")
            params.append(1)
            self.conn.execute(
                f"UPDATE context_budget SET {', '.join(sets)} WHERE id = ?", params
            )
            self.conn.commit()
        return self.get_budget()

    def build_context(
        self,
        session_id: str = "",
        query: str = "",
        max_tokens: int = None,
        agent_id: str = "",
    ) -> str:
        budget = self.get_budget()
        total = max_tokens or budget["total_budget"]
        role_overrides = self._get_role_budget_overrides(agent_id)
        rules_pct = role_overrides.get("rules_pct", budget["rules_pct"])
        knowledge_pct = role_overrides.get("knowledge_pct", budget["knowledge_pct"])
        exp_pct = role_overrides.get("experience_pct", budget["experience_pct"])
        mem_pct = role_overrides.get("memory_pct", budget["memory_pct"])
        char_budget = total * 2

        sections = []

        # --- 规则：按分类精细分配预算 ---
        rules_text = self._build_rules_context(char_budget * rules_pct / 100, agent_id)
        if rules_text:
            sections.append(f"## 📋 当前生效规则\n\n{rules_text}")

        knowledge = self._get_top_content(
            "knowledge",
            "confidence DESC, updated_at DESC",
            int(char_budget * knowledge_pct / 100),
        )
        if knowledge:
            sections.append(f"## 📚 相关知识\n\n{knowledge}")

        experiences = self._get_top_content(
            "experiences",
            "is_resolved ASC, severity DESC, updated_at DESC",
            int(char_budget * exp_pct / 100),
            extra_where="AND is_resolved = 0",
        )
        if experiences:
            sections.append(f"## 💡 相关经验（未解决）\n\n{experiences}")

        memories = self._get_top_content(
            "memories",
            "importance DESC, updated_at DESC",
            int(char_budget * mem_pct / 100),
            extra_where="AND (expires_at = '' OR expires_at > datetime('now'))",
        )
        if memories:
            sections.append(f"## 🧠 相关记忆\n\n{memories}")

        if not sections:
            return ""
        return (
            f"<!-- 知识库上下文（预算 {total} tokens）-->\n\n"
            + "\n\n".join(sections)
        )

    def _build_rules_context(self, total_chars: int, agent_id: str = "") -> str:
        """按分类精细分配规则预算，高权重分类获得更多空间"""
        # 获取所有活跃规则
        cursor = self.conn.execute(
            "SELECT title, content, category, priority FROM rules "
            "WHERE is_active = 1 ORDER BY priority DESC, updated_at DESC"
        )
        all_rules = [dict(row) for row in cursor.fetchall()]

        if not all_rules:
            return ""

        # 按分类分组，解析旧分类名
        category_rules: Dict[str, list] = {}
        for rule in all_rules:
            cat = resolve_category(rule.get("category", "general"))
            if cat not in category_rules:
                category_rules[cat] = []
            category_rules[cat].append(rule)

        # 计算每个分类的预算分配
        total_weight = sum(
            RULE_CATEGORIES.get(cat, RULE_CATEGORIES["general"])["budget_weight"]
            * len(rules)
            for cat, rules in category_rules.items()
        )

        if total_weight == 0:
            return ""

        sections = []
        used_chars = 0

        # 按权重降序排列分类
        sorted_cats = sorted(
            category_rules.keys(),
            key=lambda c: RULE_CATEGORIES.get(c, RULE_CATEGORIES["general"])[
                "budget_weight"
            ],
            reverse=True,
        )

        for cat in sorted_cats:
            cat_info = RULE_CATEGORIES.get(cat, RULE_CATEGORIES["general"])
            rules = category_rules[cat]
            cat_weight = cat_info["budget_weight"] * len(rules)
            cat_budget = int(total_chars * cat_weight / total_weight)

            cat_parts = []
            cat_used = 0
            for rule in rules:
                entry = f"### {rule['title']}\n\n{rule['content']}"
                if cat_used + len(entry) > cat_budget:
                    remaining = cat_budget - cat_used
                    if remaining > 50:
                        truncated = entry[:remaining]
                        last_nl = truncated.rfind("\n")
                        if last_nl > remaining * 0.5:
                            truncated = truncated[:last_nl]
                        cat_parts.append(truncated + "\n\n...")
                    break
                cat_parts.append(entry)
                cat_used += len(entry)

            if cat_parts:
                cat_text = "\n\n---\n\n".join(cat_parts)
                sections.append(f"### {cat_info['icon']} {cat_info['label']}\n\n{cat_text}")
                used_chars += cat_used

        return "\n\n---\n\n".join(sections)

    def _get_top_content(
        self,
        table: str,
        order_by: str,
        max_chars: int,
        extra_where: str = "",
    ) -> str:
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
                    if last_nl > remaining * 0.5:
                        truncated = truncated[:last_nl]
                    result_parts.append(truncated + "\n\n...")
                break
            result_parts.append(entry)
            total_chars += len(entry)
        return "\n\n---\n\n".join(result_parts)

    def _default_budget(self) -> dict:
        return {
            "id": 1,
            "total_budget": 4000,
            "rules_pct": 15,
            "knowledge_pct": 25,
            "experience_pct": 15,
            "memory_pct": 20,
            "session_pct": 25,
            "updated_at": "",
        }

    def _get_role_budget_overrides(self, agent_id: str) -> dict:
        if not agent_id:
            return {}
        ROLE_BUDGETS = {
            "coder": {
                "rules_pct": 20,
                "knowledge_pct": 20,
                "experience_pct": 20,
                "memory_pct": 10,
            },
            "researcher": {
                "rules_pct": 10,
                "knowledge_pct": 35,
                "experience_pct": 10,
                "memory_pct": 15,
            },
            "general": {
                "rules_pct": 15,
                "knowledge_pct": 25,
                "experience_pct": 15,
                "memory_pct": 20,
            },
        }
        try:
            from backend.services.agent_identity import agent_identity_manager

            agent = agent_identity_manager.get_agent(agent_id)
            if agent:
                return ROLE_BUDGETS.get(agent.get("role", "general"), {})
        except Exception:
            pass
        return {}


def inject_knowledge_context(session_id: str = "", query: str = "") -> str:
    svc = ContextBudgetService()
    return svc.build_context(session_id=session_id, query=query)
