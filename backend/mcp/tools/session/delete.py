# -*- coding: utf-8 -*-
"""删除指定会话及其所有消息"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="delete_session",
        description="删除指定会话及其所有消息",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "要删除的会话 ID"}
            },
            "required": ["session_id"]
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """删除指定会话及其所有消息"""
    from backend.services.hermes_service import hermes_service

    try:
        success = hermes_service.delete_session(args["session_id"])
        if success:
            return success_response(
                data={"session_id": args["session_id"]},
                message=f"会话 {args['session_id']} 已删除",
            )
        else:
            return error_response(
                message=f"删除失败：会话 {args['session_id']} 不存在",
                code="NOT_FOUND",
            )
    except Exception as e:
        return error_response(str(e))
