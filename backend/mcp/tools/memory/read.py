# -*- coding: utf-8 -*-
"""读取 Agent 的长期记忆（MEMORY.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="read_memory",
        description="读取 Agent 的长期记忆（MEMORY.md）",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """读取 Agent 的长期记忆"""
    from backend.services.hermes_service import hermes_service
    try:
        data = hermes_service.read_memory()
        return success_response(data=data.get("memory", "无记忆内容"))
    except Exception as e:
        return error_response(str(e))
