# -*- coding: utf-8 -*-
"""更新指定技能的内容"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="update_skill",
        description="更新指定技能的内容",
        schema={
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "技能名称"},
                "content": {"type": "string", "description": "新的技能内容（Markdown 格式）"}
            },
            "required": ["skill_name", "content"]
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """更新指定技能的内容"""
    from backend.services.hermes_service import hermes_service

    try:
        result = hermes_service.update_skill(
            name=args["skill_name"],
            content=args["content"],
        )
        return success_response(
            data={"skill_name": args["skill_name"]},
            message=result.get("message", "操作完成"),
        )
    except Exception as e:
        return error_response(str(e))
