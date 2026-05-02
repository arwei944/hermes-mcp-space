# -*- coding: utf-8 -*-
"""获取经验详情"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="experience_get",
        description="获取经验详情",
        schema={
            "type": "object",
            "properties": {
                "exp_id": {"type": "string", "description": "经验 ID"},
            },
            "required": ["exp_id"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService

    try:
        svc = KnowledgeService()
        item = svc.get_experience(args["exp_id"])
        if not item:
            return error_response(f"经验 {args['exp_id']} 不存在")
        return success_response(data=item)
    except Exception as e:
        return error_response(str(e))
