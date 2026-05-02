# -*- coding: utf-8 -*-
"""列出所有可用的工具及其状态"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_tools",
        description="列出所有可用的工具及其状态",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """list_tools handler"""
    try:
        from backend.services.hermes_service import hermes_service

        tools = hermes_service.list_tools()
        if not tools:
            return success_response("当前没有可用工具")
        lines = []
        for t in tools:
            status = "✅" if t.get("status") == "active" else "❌"
            lines.append(f"{status} {t.get('name', '?')}: {t.get('description', '无描述')}")
        result = f"共 {len(tools)} 个工具:\n" + "\n".join(lines)
        return success_response(result)
    except Exception as e:
        return error_response(f"列出工具失败: {e}")
