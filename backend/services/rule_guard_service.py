# -*- coding: utf-8 -*-
"""规则守卫服务 — 检查工具调用是否违反安全规则

在工具调用前自动检查：
1. safety 类规则 — 硬性拦截
2. behavior 类规则 — 软性警告（附加到结果中）
3. 工具级 scope 规则 — 精确匹配
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from backend.db import get_knowledge_db

logger = logging.getLogger("hermes-mcp")


class RuleGuardService:
    """规则守卫 — 在工具调用前检查合规性"""

    # 需要安全检查的高风险工具
    HIGH_RISK_TOOLS = {
        "shell_execute", "safe_shell_execute",
        "web_fetch", "web_search",
        "github_operations",
        "db_query", "db_manage_connections",
        "email_operations",
        "document_parse", "document_convert",
        "batch_operations",
    }

    # 中等风险工具
    MEDIUM_RISK_TOOLS = {
        "rule_create", "rule_update", "rule_delete",
        "knowledge_create", "knowledge_update", "knowledge_delete",
        "memory_create", "memory_forget",
        "experience_create", "experience_update",
        "delegate_task",
        "create_cron", "delete_cron",
    }

    def __init__(self):
        self.conn = get_knowledge_db()
        self._cache: Optional[List[dict]] = None
        self._cache_time: float = 0

    def _get_active_rules(self) -> List[dict]:
        """获取所有活跃规则（带简单缓存，30秒过期）"""
        import time
        now = time.time()
        if self._cache is not None and (now - self._cache_time) < 30:
            return self._cache
        try:
            cursor = self.conn.execute(
                "SELECT id, title, content, category, priority, scope, scope_value, tags "
                "FROM rules WHERE is_active = 1 ORDER BY priority DESC"
            )
            self._cache = [dict(row) for row in cursor.fetchall()]
            self._cache_time = now
            return self._cache
        except Exception as e:
            logger.warning(f"RuleGuard: failed to load rules: {e}")
            return []

    def check_tool_call(
        self, tool_name: str, arguments: dict, agent_id: str = ""
    ) -> Tuple[bool, str, List[str]]:
        """检查工具调用是否合规

        Returns:
            (allowed, block_reason, warnings)
            - allowed: 是否允许执行
            - block_reason: 如果被拦截，说明原因
            - warnings: 软性警告列表（不阻止执行，但提醒 Agent）
        """
        rules = self._get_active_rules()
        if not rules:
            return True, "", []

        warnings = []

        # 1. 检查 safety 类规则 — 硬性拦截
        for rule in rules:
            if rule.get("category") != "safety":
                continue
            match = self._match_rule(rule, tool_name, arguments)
            if match:
                logger.warning(
                    f"RuleGuard: BLOCKED {tool_name} by safety rule '{rule['title']}'"
                )
                return False, f"安全规则拦截 [{rule['title']}]: {rule['content']}", warnings

        # 2. 检查工具级 scope 规则
        for rule in rules:
            if rule.get("scope") != "tool":
                continue
            if rule.get("scope_value", "").lower() == tool_name.lower():
                # 这是一个针对特定工具的规则，检查是否违反
                match = self._match_rule_content(rule["content"], arguments)
                if match:
                    severity = rule.get("priority", 5)
                    if severity >= 8:
                        logger.warning(
                            f"RuleGuard: BLOCKED {tool_name} by tool-scope rule '{rule['title']}'"
                        )
                        return False, f"工具规则拦截 [{rule['title']}]: {rule['content']}", warnings
                    else:
                        warnings.append(f"⚠️ [{rule['title']}]: {rule['content']}")

        # 3. 检查 behavior 类规则 — 软性警告
        if tool_name in self.HIGH_RISK_TOOLS or tool_name in self.MEDIUM_RISK_TOOLS:
            for rule in rules:
                if rule.get("category") != "behavior":
                    continue
                match = self._match_rule(rule, tool_name, arguments)
                if match:
                    warnings.append(f"💡 [{rule['title']}]: {rule['content']}")

        return True, "", warnings

    def _match_rule(self, rule: dict, tool_name: str, arguments: dict) -> bool:
        """检查规则是否匹配当前工具调用"""
        content = rule.get("content", "")
        scope = rule.get("scope", "global")

        # global scope — 检查所有工具调用
        if scope == "global":
            return self._match_rule_content(content, arguments)

        # tool scope — 只检查匹配的工具
        if scope == "tool":
            if rule.get("scope_value", "").lower() != tool_name.lower():
                return False
            return self._match_rule_content(content, arguments)

        return False

    def _match_rule_content(self, content: str, arguments: dict) -> bool:
        """检查规则内容是否与参数匹配

        支持的规则语法：
        - 纯文本描述：包含关键词即匹配
        - FORBID:xxx — 参数中包含 xxx 则匹配（禁止模式）
        - REQUIRE:xxx — 参数中不包含 xxx 则匹配（必须模式）
        - REGEX:pattern — 正则匹配参数的 JSON 表示
        """
        if not content or not arguments:
            return False

        args_str = json.dumps(arguments, ensure_ascii=False).lower()

        for line in content.split("\n"):
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue

            # FORBID 模式
            if line.upper().startswith("FORBID:"):
                keyword = line[7:].strip().lower()
                if keyword and keyword in args_str:
                    return True

            # REQUIRE 模式
            elif line.upper().startswith("REQUIRE:"):
                keyword = line[8:].strip().lower()
                if keyword and keyword not in args_str:
                    return True

            # REGEX 模式
            elif line.upper().startswith("REGEX:"):
                pattern = line[6:].strip()
                try:
                    if re.search(pattern, args_str, re.IGNORECASE):
                        return True
                except re.error:
                    pass

            # 纯文本关键词匹配
            else:
                keyword = line.lower()
                if len(keyword) >= 3 and keyword in args_str:
                    return True

        return False

    def get_tool_risk_level(self, tool_name: str) -> str:
        """获取工具风险等级"""
        if tool_name in self.HIGH_RISK_TOOLS:
            return "high"
        if tool_name in self.MEDIUM_RISK_TOOLS:
            return "medium"
        return "low"


# 全局单例
rule_guard_service = RuleGuardService()
