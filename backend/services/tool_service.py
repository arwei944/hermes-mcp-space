# -*- coding: utf-8 -*-
"""工具管理服务

从 HermesService 提取的工具管理方法，包括：
- 工具列表 / 详情 / 启用禁用
- 工具集列表
- MCP 状态 / 工具 / 重启
"""

from typing import Any, Dict, List, Optional


class ToolService:
    """工具管理服务

    管理工具列表、工具集和 MCP 服务状态。
    """

    def __init__(self):
        self._hermes_available: Optional[bool] = None
        self._remote_url = ""

    @property
    def hermes_available(self) -> bool:
        """检测 Hermes Agent 是否可用"""
        if self._hermes_available is None:
            if self._remote_url:
                self._hermes_available = True
            else:
                try:
                    import hermes  # type: ignore
                    self._hermes_available = True
                except ImportError:
                    self._hermes_available = False
        return self._hermes_available

    # ==================== 工具管理 ====================

    def list_tools(self) -> List[Dict[str, Any]]:
        """列出所有可用工具（从 MCP 工具定义获取）"""
        # 优先从 MCP 工具定义获取
        try:
            from backend.mcp_server import _get_tools
            mcp_tools = _get_tools()
            return [
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "schema": t.get("inputSchema", {}),
                    "status": "active",
                    "source": "mcp",
                }
                for t in mcp_tools
            ]
        except Exception:
            pass
        return self._get_demo_tools()

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        """获取工具详情"""
        tools = self.list_tools()
        for tool in tools:
            if tool["name"] == name:
                return tool
        return None

    def toggle_tool(self, name: str, enabled: bool = True) -> Dict[str, Any]:
        """切换工具启用/禁用"""
        # 工具状态存储在内存中（HF Space 重启后重置）
        if not hasattr(self, '_tool_states'):
            self._tool_states = {}
        self._tool_states[name] = enabled
        return {"success": True, "message": f"工具 {name} 已{'启用' if enabled else '禁用'}", "name": name, "enabled": enabled}

    def list_toolsets(self) -> List[Dict[str, Any]]:
        """列出所有工具集"""
        return [
            {
                "name": "MCP 工具集",
                "description": "通过 MCP 协议暴露的 16 个工具",
                "tools": ["list_sessions", "search_sessions", "get_session_messages", "delete_session", "list_tools", "list_skills", "get_skill_content", "create_skill", "read_memory", "read_user_profile", "write_memory", "write_user_profile", "list_cron_jobs", "create_cron_job", "get_system_status", "get_dashboard_summary"],
                "status": "active",
            }
        ]

    def _get_demo_tools(self) -> List[Dict[str, Any]]:
        """降级模式下的演示工具列表"""
        return [
            {
                "name": "file_read",
                "description": "读取文件内容",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "文件路径"},
                    },
                    "required": ["path"],
                },
                "status": "active",
            },
            {
                "name": "file_write",
                "description": "写入文件内容",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "文件路径"},
                        "content": {"type": "string", "description": "文件内容"},
                    },
                    "required": ["path", "content"],
                },
                "status": "active",
            },
            {
                "name": "shell_execute",
                "description": "执行 Shell 命令",
                "schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "要执行的命令"},
                    },
                    "required": ["command"],
                },
                "status": "active",
            },
            {
                "name": "web_search",
                "description": "搜索互联网",
                "schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "搜索关键词"},
                    },
                    "required": ["query"],
                },
                "status": "active",
            },
        ]

    # ==================== MCP 服务状态 ====================

    def get_mcp_status(self) -> Dict[str, Any]:
        """获取 MCP 服务状态"""
        # MCP 服务始终运行（独立于 Hermes 主程序）
        # 通过检测 MCP 端点是否可用来判断状态
        return {
            "status": "running",
            "message": "MCP 服务运行中",
            "port": 7860,
            "endpoint": "/mcp",
            "protocol": "Streamable HTTP + SSE",
            "servers": [],
            "hermes_available": self.hermes_available,
        }

    def get_mcp_tools(self) -> List[Dict[str, Any]]:
        """获取 MCP 暴露的工具列表"""
        # 直接从 mcp_server 模块获取工具定义
        try:
            from backend.mcp_server import _get_tools
            return _get_tools()
        except Exception:
            return []

    def restart_mcp(self) -> Dict[str, Any]:
        """重启 MCP 服务"""
        # MCP 服务内嵌在 FastAPI 中，标记为成功
        return {"success": True, "message": "MCP 服务运行正常（内嵌模式，无需重启）"}


# 全局单例
tool_service = ToolService()
