# -*- coding: utf-8 -*-
"""移除外部 MCP 服务器"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="remove_mcp_server",
        description="移除外部 MCP 服务器",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "服务器名称"}
            },
            "required": ["name"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """remove_mcp_server handler"""
    try:
        from backend.services.mcp_client_service import mcp_client_service

        server_name = args.get("name", "")
        result = mcp_client_service.remove_server(server_name)
        if not result.get("success"):
            return error_response(
                message=f"{result.get('message', '移除失败')}\n建议：\n1. 使用 list_mcp_servers 确认服务器名称是否正确\n2. 确认该服务器当前处于已连接状态\n3. 服务器名称区分大小写，请检查拼写",
                code="REMOVE_SERVER_ERROR",
            )
        return success_response(message=f"已移除 MCP 服务器 '{server_name}'")
    except Exception as e:
        return error_response(message=f"移除 MCP 服务器失败: {e}", code="REMOVE_SERVER_ERROR")
