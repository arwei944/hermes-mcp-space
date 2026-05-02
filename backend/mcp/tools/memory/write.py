# -*- coding: utf-8 -*-
"""写入/更新 Agent 的长期记忆"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="write_memory",
        description="写入/更新 Agent 的长期记忆",
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "要保存的记忆内容（Markdown 格式）"}
            },
            "required": ["content"]
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """写入/更新 Agent 的长期记忆"""
    from backend.services.hermes_service import hermes_service
    try:
        result = hermes_service.update_memory(memory=args["content"])
        return success_response(message=result.get("message", "操作完成"))
    except Exception as e:
        return error_response(str(e))
