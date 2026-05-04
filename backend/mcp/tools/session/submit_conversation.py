# -*- coding: utf-8 -*-
"""MCP Tool: submit_conversation - 提交对话记录

Agent 在完成一次有意义的对话后调用此工具，提交完整的对话记录。
系统会自动将对话内容存储到会话中，并触发知识提取。
"""

import logging
from typing import Any, Dict

logger = logging.getLogger("hermes.mcp.tools")


def register(registry):
    def handler(arguments: Dict[str, Any]) -> str:
        messages = arguments.get("messages", [])
        target_session_id = arguments.get("session_id", "")
        if not messages:
            return "没有消息需要提交"
        recorded_count = 0
        try:
            from backend.services.hermes_service import hermes_service as _hs
            if not target_session_id:
                try:
                    sessions = _hs.list_sessions()
                    if sessions:
                        target_session_id = sessions[0].get("id", "")
                except Exception:
                    pass
            if not target_session_id:
                return "没有活跃会话，无法记录对话"
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if not content or not isinstance(content, str) or len(content.strip()) < 2:
                    continue
                _hs.add_session_message(session_id=target_session_id, role=role, content=content, metadata={"source": "submit_conversation"})
                recorded_count += 1
            try:
                from backend.services.session_lifecycle import session_lifecycle
                active = session_lifecycle.get_active_sessions()
                for s in active:
                    if s.get("hermes_session_id") == target_session_id:
                        session_lifecycle.on_message(s.get("mcp_session_id", ""))
                        break
            except Exception:
                pass
        except Exception as e:
            logger.error(f"submit_conversation failed: {e}")
            return f"提交失败: {e}"
        return f"已记录 {recorded_count} 条消息到会话 {target_session_id[:16]}..."

    registry.register_tool(
        name="submit_conversation",
        description="提交对话记录。Agent 应在每次完成有意义的对话后调用此工具，这样系统才能从对话中学习和进化。",
        handler=handler,
        input_schema={
            "type": "object",
            "properties": {
                "messages": {"type": "array", "description": "对话消息列表",
                    "items": {"type": "object", "properties": {
                        "role": {"type": "string", "enum": ["user", "assistant", "system"]},
                        "content": {"type": "string"}},
                    "required": ["role", "content"]}},
                "session_id": {"type": "string", "description": "目标会话 ID"},
            },
            "required": ["messages"],
        },
    )