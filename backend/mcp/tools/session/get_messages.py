# -*- coding: utf-8 -*-
"""获取指定会话的消息历史"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="get_session_messages",
        description="获取指定会话的消息历史",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "会话 ID"},
                "limit": {"type": "integer", "default": 50, "description": "返回的最大消息数"}
            },
            "required": ["session_id"]
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """获取指定会话的消息历史"""
    from backend.services.hermes_service import hermes_service

    try:
        messages = hermes_service.get_session_messages(args["session_id"])
        limit = args.get("limit", 50)
        result = messages[-limit:]
        if not result:
            return success_response(
                data={"messages": [], "session_id": args["session_id"]},
                message=f"会话 {args['session_id']} 没有消息记录",
            )
        lines = []
        for msg in result:
            role = msg.get("role", "?")
            content = str(msg.get("content", ""))[:200]
            lines.append(f"[{role}] {content}")
        return success_response(
            data={"messages": result, "session_id": args["session_id"]},
            message="\n".join(lines),
        )
    except Exception as e:
        return error_response(str(e))
