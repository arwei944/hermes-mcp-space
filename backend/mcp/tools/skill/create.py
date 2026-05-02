# -*- coding: utf-8 -*-
"""创建一个新技能"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="create_skill",
        description="创建一个新技能",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "技能名称（英文、数字、下划线）"},
                "content": {"type": "string", "description": "技能内容（Markdown 格式）"}
            },
            "required": ["name"]
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """创建一个新技能"""
    from backend.services.hermes_service import hermes_service

    try:
        result = hermes_service.create_skill(
            name=args["name"],
            content=args.get("content", ""),
        )
        if not result.get("success"):
            return error_response(
                message=(
                    f"{result.get('message', '创建失败')}\n"
                    f"建议：\n"
                    f"1. 检查技能名是否已存在，使用 list_skills 查看\n"
                    f"2. 如需更新已有技能，使用 update_skill\n"
                    f"3. 使用不同的技能名称"
                ),
                code="CREATE_FAILED",
            )
        return success_response(
            data={"name": args["name"]},
            message=result.get("message", "操作完成"),
        )
    except Exception as e:
        return error_response(str(e))
