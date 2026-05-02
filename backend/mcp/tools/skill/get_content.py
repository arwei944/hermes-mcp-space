# -*- coding: utf-8 -*-
"""获取指定技能的详细内容"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="get_skill_content",
        description="获取指定技能的详细内容",
        schema={
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "技能名称"}
            },
            "required": ["skill_name"]
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """获取指定技能的详细内容"""
    from backend.services.hermes_service import hermes_service

    try:
        skill = hermes_service.get_skill(args["skill_name"])
        if skill is None:
            return error_response(
                message=f"技能 '{args['skill_name']}' 不存在",
                code="NOT_FOUND",
            )
        return success_response(
            data={"skill": skill},
            message=skill.get("content", ""),
        )
    except Exception as e:
        return error_response(str(e))
