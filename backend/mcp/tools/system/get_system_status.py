# -*- coding: utf-8 -*-
"""获取 Hermes Agent 系统状态"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="get_system_status",
        description="获取 Hermes Agent 系统状态",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """get_system_status handler"""
    try:
        from backend.services.hermes_service import hermes_service
        from backend.version import __version__

        status = hermes_service.get_mcp_status()
        result = (
            f"Hermes Agent 系统状态:\n"
            f"- MCP 服务: {status.get('status', 'unknown')}\n"
            f"- Hermes 可用: {'是' if hermes_service.hermes_available else '否'}\n"
            f"- 版本: {__version__}"
        )
        return success_response(result)
    except Exception as e:
        return error_response(f"获取系统状态失败: {e}")
