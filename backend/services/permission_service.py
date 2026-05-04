# -*- coding: utf-8 -*-
"""Agent 权限服务 — 基于角色的访问控制

不同角色的 Agent 对工具和数据有不同的访问权限：
- coder: 可执行 shell、GitHub 操作，侧重代码相关
- researcher: 可搜索网络、管理知识，侧重研究相关
- general: 通用权限，部分高风险操作受限
- admin: 管理员权限（预留）
"""

import json
import logging
from typing import Any, Dict, List, Optional, Set
from backend.db import get_knowledge_db

logger = logging.getLogger("hermes-mcp")

# ============================================================
# 角色权限定义
# ============================================================
ROLE_PERMISSIONS = {
    "coder": {
        "label": "代码实践记录者",
        # 允许的工具标签
        "allowed_tool_tags": {"knowledge", "memory", "session", "feedback", "skill", "file", "browser", "system", "plugin", "compat"},
        # 允许的高风险工具
        "allowed_high_risk_tools": {
            "shell_execute", "safe_shell_execute",
            "github_operations",
            "db_query",
            "document_parse", "document_convert",
            "batch_operations",
        },
        # 禁止的工具（即使标签允许）
        "denied_tools": set(),
        # 允许的规则分类（可查看/引用）
        "allowed_rule_categories": {"safety", "coding", "workflow", "behavior", "output_control", "general", "priority", "domain"},
        # 可写入的规则分类（可创建/修改）
        "writable_rule_categories": {"coding", "workflow", "general", "output_control"},
        # 知识操作权限
        "can_delete_knowledge": False,
        "can_delete_memory": False,
        # 额外说明
        "description": "可执行代码相关操作，不可删除知识和记忆",
    },
    "researcher": {
        "label": "知识采集记录者",
        "allowed_tool_tags": {"knowledge", "memory", "session", "feedback", "skill", "file", "system", "plugin", "compat"},
        "allowed_high_risk_tools": {
            "web_fetch", "web_search",
            "document_parse", "document_convert",
            "data_analyze", "data_visualize",
        },
        "denied_tools": {"shell_execute", "safe_shell_execute", "github_operations"},
        "allowed_rule_categories": {"safety", "behavior", "output_control", "general", "priority", "domain", "workflow"},
        "writable_rule_categories": {"behavior", "output_control", "general", "domain"},
        "can_delete_knowledge": False,
        "can_delete_memory": False,
        "description": "可搜索网络和管理知识，不可执行 shell 或 GitHub 操作",
    },
    "general": {
        "label": "通用助手",
        "allowed_tool_tags": {"knowledge", "memory", "session", "feedback", "skill", "file", "browser", "system", "plugin", "compat"},
        "allowed_high_risk_tools": {
            "shell_execute", "safe_shell_execute",
            "web_fetch", "web_search",
            "github_operations",
            "db_query", "db_manage_connections",
            "email_operations",
            "document_parse", "document_convert",
            "batch_operations",
            "delegate_task",
            "data_analyze", "data_visualize",
            "rule_create", "rule_update", "rule_delete",
            "knowledge_create", "knowledge_update", "knowledge_delete",
            "memory_create", "memory_forget",
            "experience_create", "experience_update",
        },
        "denied_tools": set(),
        "allowed_rule_categories": {"safety", "coding", "workflow", "behavior", "output_control", "general", "priority", "domain"},
        "writable_rule_categories": {"safety", "coding", "workflow", "behavior", "output_control", "general", "priority", "domain"},
        "can_delete_knowledge": True,
        "can_delete_memory": True,
        "description": "完全权限，可执行所有操作",
    },
    "admin": {
        "label": "管理员",
        "allowed_tool_tags": {"knowledge", "memory", "session", "feedback", "skill", "file", "browser", "system", "plugin", "compat"},
        "allowed_high_risk_tools": {
            "shell_execute", "safe_shell_execute",
            "web_fetch", "web_search",
            "github_operations",
            "db_query", "db_manage_connections",
            "email_operations",
            "document_parse", "document_convert",
            "batch_operations",
            "delegate_task",
            "data_analyze", "data_visualize",
        },
        "denied_tools": set(),
        "allowed_rule_categories": {"safety", "coding", "workflow", "behavior", "output_control", "general", "priority", "domain"},
        "writable_rule_categories": {"safety", "coding", "workflow", "behavior", "output_control", "general", "priority", "domain"},
        "can_delete_knowledge": True,
        "can_delete_memory": True,
        "description": "完全权限，可执行所有操作",
    },
}

# 工具名 → 标签映射（用于权限检查）
TOOL_TAG_MAP = {
    # knowledge 组
    "knowledge_search": "knowledge", "knowledge_create": "knowledge", "knowledge_get": "knowledge",
    "knowledge_list": "knowledge", "knowledge_update": "knowledge", "knowledge_delete": "knowledge",
    "knowledge_overview": "knowledge", "knowledge_extract": "knowledge", "knowledge_auto_update": "knowledge",
    "rule_search": "knowledge", "rule_create": "knowledge", "rule_get": "knowledge",
    "rule_list": "knowledge", "rule_update": "knowledge", "rule_delete": "knowledge",
    "experience_create": "knowledge", "experience_get": "knowledge", "experience_list": "knowledge",
    "experience_search": "knowledge", "experience_resolve": "knowledge", "experience_update": "knowledge",
    "experience_to_rule": "knowledge",
    "memory_create": "knowledge", "memory_get": "knowledge", "memory_list": "knowledge",
    "memory_search": "knowledge", "memory_forget": "knowledge", "memory_update": "knowledge",
    "auto_review": "knowledge", "batch_review": "knowledge", "configure_review_policy": "knowledge",
    "auto_cleanup_knowledge": "knowledge", "auto_resolve_experience": "knowledge",
    "context_budget_preview": "knowledge",
    # session 组
    "create_session": "session", "list_sessions": "session", "get_session_messages": "session",
    "search_sessions": "session", "search_messages": "session", "delete_session": "session",
    "add_message": "session", "compress_session": "session",
    # feedback 组
    "submit_feedback": "feedback", "submit_conversation": "feedback",
    # skill 组
    "create_skill": "skill", "delete_skill": "skill", "get_skill_content": "skill",
    "update_skill": "skill", "list_skills": "skill", "search_skills_hub": "skill",
    "install_skill_hub": "skill", "suggest_skill": "skill",
    "auto_create_skill_from_pattern": "skill", "auto_optimize_skill": "skill",
    "evaluate_skill": "skill",
    # file 组
    "read_file": "file", "write_file": "file", "list_directory": "file", "search_files": "file",
    # browser 组
    "browser_navigate": "browser", "browser_click": "browser", "browser_type": "browser",
    "browser_screenshot": "browser", "browser_snapshot": "browser", "browser_evaluate": "browser",
    # system 组
    "shell_execute": "system", "safe_shell_execute": "system",
    "web_fetch": "system", "web_search": "system",
    "github_operations": "system",
    "db_query": "system", "db_manage_connections": "system",
    "email_operations": "system",
    "document_parse": "system", "document_convert": "system",
    "batch_operations": "system", "delegate_task": "system",
    "data_analyze": "system", "data_visualize": "system",
    "add_mcp_server": "system", "remove_mcp_server": "system", "list_mcp_servers": "system",
    "refresh_mcp_servers": "system",
    "get_config": "system", "update_config": "system",
    "get_dashboard": "system", "get_logs": "system", "get_system_status": "system",
    "list_tools": "system", "list_cron": "system", "create_cron": "system", "delete_cron": "system",
    "log_conversation": "system", "audit_trail": "system", "change_tracker": "system",
    "register_webhook": "system", "capture_screenshot": "system", "send_notification": "system",
    "test_hello": "system",
    # plugin 组
    "install_plugin": "plugin", "list_plugins": "plugin", "uninstall_plugin": "plugin",
    # compat 组
    "read_memory": "compat", "write_memory": "compat", "read_soul": "compat", "write_soul": "compat",
    "read_user_profile": "compat", "write_user_profile": "compat",
    "read_agents_md": "compat", "write_agents_md": "compat",
    "read_learnings": "compat", "add_learning": "compat", "query_memory": "compat", "store_memory": "compat",
    "unified_search": "compat", "compat_sync_db_to_md": "compat", "compat_sync_md_to_db": "compat",
}


class PermissionService:
    """Agent 权限服务"""

    def __init__(self):
        self.conn = get_knowledge_db()
        self._custom_permissions: Dict[str, dict] = {}

    def get_role_permissions(self, role: str) -> dict:
        """获取角色的权限定义"""
        return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["general"])

    def check_tool_permission(
        self, tool_name: str, agent_id: str = "", role: str = ""
    ) -> tuple:
        """检查 Agent 是否有权限调用某工具

        Returns:
            (allowed: bool, reason: str)
        """
        if not role and agent_id:
            role = self._infer_role(agent_id)

        perms = self.get_role_permissions(role)

        # 1. 检查明确禁止的工具
        if tool_name in perms["denied_tools"]:
            return False, f"角色 '{perms['label']}' 无权使用工具 '{tool_name}'"

        # 2. 检查高风险工具白名单
        from backend.services.rule_guard_service import RuleGuardService
        guard = RuleGuardService()
        if tool_name in guard.HIGH_RISK_TOOLS or tool_name in guard.MEDIUM_RISK_TOOLS:
            if tool_name not in perms["allowed_high_risk_tools"]:
                return False, f"角色 '{perms['label']}' 无权使用高风险工具 '{tool_name}'"

        # 3. 检查工具标签
        tool_tag = TOOL_TAG_MAP.get(tool_name, "system")
        if tool_tag not in perms["allowed_tool_tags"]:
            return False, f"角色 '{perms['label']}' 无权访问 '{tool_tag}' 类工具"

        # 4. 检查自定义权限覆盖
        custom = self._get_custom_permission(agent_id)
        if custom:
            if tool_name in custom.get("denied_tools", set()):
                return False, f"Agent '{agent_id}' 被自定义规则禁止使用 '{tool_name}'"
            if tool_name in custom.get("extra_allowed_tools", set()):
                return True, ""

        return True, ""

    def check_rule_permission(
        self, category: str, action: str = "read", agent_id: str = "", role: str = ""
    ) -> tuple:
        """检查 Agent 是否有权限操作某分类的规则

        Args:
            category: 规则分类
            action: "read" 或 "write"
        Returns:
            (allowed: bool, reason: str)
        """
        if not role and agent_id:
            role = self._infer_role(agent_id)

        perms = self.get_role_permissions(role)

        if action == "read":
            if category in perms["allowed_rule_categories"]:
                return True, ""
            return False, f"角色 '{perms['label']}' 无权查看 '{category}' 类规则"

        if action == "write":
            if category in perms["writable_rule_categories"]:
                return True, ""
            return False, f"角色 '{perms['label']}' 无权修改 '{category}' 类规则"

        return False, f"未知操作类型: {action}"

    def check_data_permission(
        self, data_type: str, action: str, agent_id: str = "", role: str = ""
    ) -> tuple:
        """检查数据操作权限（删除知识/记忆等）

        Args:
            data_type: "knowledge" / "memory" / "experience"
            action: "read" / "create" / "update" / "delete"
        """
        if not role and agent_id:
            role = self._infer_role(agent_id)

        perms = self.get_role_permissions(role)

        if action == "delete":
            if data_type == "knowledge" and not perms["can_delete_knowledge"]:
                return False, f"角色 '{perms['label']}' 无权删除知识"
            if data_type == "memory" and not perms["can_delete_memory"]:
                return False, f"角色 '{perms['label']}' 无权删除记忆"

        return True, ""

    def _infer_role(self, agent_id: str) -> str:
        """从 agent_id 推断角色"""
        try:
            from backend.services.agent_identity import agent_identity_manager
            agent = agent_identity_manager.get_agent(agent_id)
            if agent:
                return agent.get("role", "general")
        except Exception:
            pass
        return "general"

    def _get_custom_permission(self, agent_id: str) -> Optional[dict]:
        """获取自定义权限覆盖"""
        if not agent_id:
            return None
        return self._custom_permissions.get(agent_id)

    def set_custom_permission(self, agent_id: str, permissions: dict):
        """设置自定义权限覆盖（运行时，不持久化）"""
        self._custom_permissions[agent_id] = permissions

    def get_permission_summary(self, role: str) -> dict:
        """获取角色权限摘要（用于展示）"""
        perms = self.get_role_permissions(role)
        return {
            "role": role,
            "label": perms["label"],
            "description": perms["description"],
            "allowed_tool_tags": list(perms["allowed_tool_tags"]),
            "allowed_high_risk_tools": list(perms["allowed_high_risk_tools"]),
            "denied_tools": list(perms["denied_tools"]),
            "allowed_rule_categories": list(perms["allowed_rule_categories"]),
            "writable_rule_categories": list(perms["writable_rule_categories"]),
            "can_delete_knowledge": perms["can_delete_knowledge"],
            "can_delete_memory": perms["can_delete_memory"],
        }


# 全局单例
permission_service = PermissionService()
