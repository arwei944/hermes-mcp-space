# -*- coding: utf-8 -*-
"""获取记忆详情"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="memory_get",
        description="获取记忆详情",
        schema={
            "type": "object",
            "properties": {
                "mem_id": {"type": "string", "description": "记忆 ID"},
            },
            "required": ["mem_id"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService

    try:
        svc = KnowledgeService()
        item = svc.get_memory(args["mem_id"])
        if not item:
            return error_response(f"记忆 {args['mem_id']} 不存在")
        return success_response(data=item)
    except Exception as e:
        return error_response(str(e))
