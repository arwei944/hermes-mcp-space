# -*- coding: utf-8 -*-
"""删除指定技能"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="delete_skill",
        description="删除指定技能",
        schema={
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "要删除的技能名称"}
            },
            "required": ["skill_name"]
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """删除指定技能"""
    from backend.services.hermes_service import hermes_service

    try:
        result = hermes_service.delete_skill(args["skill_name"])
        return success_response(
            data={"skill_name": args["skill_name"]},
            message=result.get("message", "操作完成"),
        )
    except Exception as e:
        return error_response(str(e))
