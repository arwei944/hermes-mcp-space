# -*- coding: utf-8 -*-
"""获取知识详情"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="knowledge_get",
        description="获取知识详情",
        schema={
            "type": "object",
            "properties": {
                "knowledge_id": {"type": "string", "description": "知识 ID"},
            },
            "required": ["knowledge_id"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService

    try:
        svc = KnowledgeService()
        item = svc.get_knowledge(args["knowledge_id"])
        if not item:
            return error_response(f"知识 {args['knowledge_id']} 不存在")
        return success_response(data=item)
    except Exception as e:
        return error_response(str(e))
