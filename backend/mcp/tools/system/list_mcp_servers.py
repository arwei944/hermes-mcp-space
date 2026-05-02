# -*- coding: utf-8 -*-
"""列出所有已连接的外部 MCP 服务器"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_mcp_servers",
        description="列出所有已连接的外部 MCP 服务器",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """list_mcp_servers handler"""
    try:
        from backend.services.mcp_client_service import mcp_client_service

        servers = mcp_client_service.list_servers()
        if not servers:
            return success_response(
                message="当前没有连接外部 MCP 服务器。使用 add_mcp_server 添加。"
            )

        output = [f"已连接 {len(servers)} 个外部 MCP 服务器\n{'='*50}"]
        for s in servers:
            output.append(f"  {s['name']} ({s['status']})")
            output.append(f"    URL: {s['url']}")
            output.append(f"    工具: {s['tools_count']} 个")
            output.append(f"    前缀: {s['prefix']}")
            if s.get("last_check"):
                output.append(f"    最后检查: {s['last_check']}")

        return success_response(
            data={"servers": servers, "total": len(servers)},
            message="\n".join(output),
        )
    except Exception as e:
        return error_response(message=f"列出 MCP 服务器失败: {e}", code="LIST_SERVERS_ERROR")
