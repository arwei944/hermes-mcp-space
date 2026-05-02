# -*- coding: utf-8 -*-
"""刷新所有外部 MCP 服务器的工具列表"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="refresh_mcp_servers",
        description="刷新所有外部 MCP 服务器的工具列表",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """refresh_mcp_servers handler"""
    try:
        from backend.services.mcp_client_service import mcp_client_service

        result = mcp_client_service.refresh_all()
        return success_response(message=result.get("message", "刷新完成"))
    except Exception as e:
        return error_response(message=f"刷新 MCP 服务器失败: {e}", code="REFRESH_ERROR")
