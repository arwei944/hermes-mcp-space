# -*- coding: utf-8 -*-
"""记录对话消息到会话（Trae 调用此工具记录与用户的对话）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="log_conversation",
        description="记录对话消息到会话（Trae 调用此工具记录与用户的对话）",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "会话 ID（可选，不传则自动使用最近活跃会话）"},
                "role": {"type": "string", "description": "消息角色: user / assistant / system", "enum": ["user", "assistant", "system"]},
                "content": {"type": "string", "description": "消息内容"},
                "summary": {"type": "string", "description": "对话摘要（可选）"}
            },
            "required": ["role", "content"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """log_conversation handler"""
    from backend.services.hermes_service import hermes_service

    try:
        role = args.get("role", "user")
        content = args.get("content", "")
        session_id = args.get("session_id", "")
        summary = args.get("summary", "")

        # 如果没有指定 session_id，使用最近活跃会话
        if not session_id:
            sessions = hermes_service.list_sessions()
            active = [s for s in sessions if s.get("status") == "active"]
            if active:
                session_id = active[0].get("id") or active[0].get("session_id", "")
            elif sessions:
                session_id = sessions[0].get("id") or sessions[0].get("session_id", "")

        if not session_id:
            # 自动创建会话
            result = hermes_service.create_session(title=summary or "Trae 对话", source="trae")
            session_id = result.get("session", {}).get("id", "")

        if not session_id:
            return error_response(message="无法获取或创建会话", code="SESSION_ERROR")

        hermes_service.add_session_message(session_id, role, content)
        try:
            from backend.routers.logs import add_log
            add_log("记录对话", session_id[:16], f"[{role}] {content[:100]}", "info", "trae")
        except Exception:
            pass
        return success_response(message=f"对话已记录到会话 {session_id[:16]}")
    except Exception as e:
        return error_response(message=f"记录对话失败: {e}", code="LOG_ERROR")
