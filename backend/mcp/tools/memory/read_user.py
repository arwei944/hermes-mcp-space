# -*- coding: utf-8 -*-
"""读取用户画像（USER.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="read_user_profile",
        description="读取用户画像（USER.md）",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """读取用户画像"""
    from backend.services.hermes_service import hermes_service
    try:
        data = hermes_service.read_memory()
        return success_response(data=data.get("user", "无用户画像"))
    except Exception as e:
        return error_response(str(e))
