# -*- coding: utf-8 -*-
"""添加外部 MCP 服务器（自动发现工具并聚合）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="add_mcp_server",
        description="添加外部 MCP 服务器（自动发现工具并聚合）",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "服务器名称（英文，如 github）"},
                "url": {"type": "string", "description": "MCP 服务器 URL（如 http://localhost:3001/mcp）"},
                "prefix": {"type": "string", "description": "工具名前缀（默认 mcp_{name}_）"}
            },
            "required": ["name", "url"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """add_mcp_server handler"""
    try:
        from backend.services.mcp_client_service import mcp_client_service

        server_name = args.get("name", "")
        url = args.get("url", "")
        prefix = args.get("prefix", "")

        result = mcp_client_service.add_server(server_name, url, prefix)
        if not result.get("success"):
            return error_response(
                message=f"{result.get('message', '添加失败')}\n建议：\n1. 检查服务器名称是否已存在（使用 list_mcp_servers 查看已添加的服务器）\n2. 确认 URL 格式正确且服务器可访问\n3. 检查服务器名称和 URL 是否拼写正确",
                code="ADD_SERVER_ERROR",
            )

        prefix_display = mcp_client_service._servers[server_name].get('prefix', '')
        return success_response(
            message=f"已添加 MCP 服务器 '{server_name}'，发现 {result.get('tools_count', 0)} 个工具（前缀: {prefix_display}）"
        )
    except Exception as e:
        return error_response(message=f"添加 MCP 服务器失败: {e}", code="ADD_SERVER_ERROR")
