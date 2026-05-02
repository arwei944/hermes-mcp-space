# -*- coding: utf-8 -*-
"""向指定会话添加一条消息"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="add_message",
        description="向指定会话添加一条消息",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "会话 ID"},
                "role": {"type": "string", "description": "角色（user/assistant/system）"},
                "content": {"type": "string", "description": "消息内容"}
            },
            "required": ["session_id", "role", "content"]
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """向指定会话添加一条消息"""
    from backend.services.hermes_service import hermes_service

    try:
        result = hermes_service.add_session_message(
            session_id=args.get("session_id", ""),
            role=args.get("role", ""),
            content=args.get("content", ""),
        )
        return success_response(
            data={"session_id": args.get("session_id", "")},
            message=result.get("message", "操作完成"),
        )
    except Exception as e:
        return error_response(str(e))
