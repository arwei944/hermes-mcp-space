# -*- coding: utf-8 -*-
"""MCP Tool: submit_feedback - 提交用户反馈"""

import logging
from typing import Any, Dict

logger = logging.getLogger("hermes.mcp.tools")


def register(registry):
    def handler(arguments: Dict[str, Any]) -> str:
        target_type = arguments.get("target_type", "response")
        target_id = arguments.get("target_id", "")
        rating = arguments.get("rating", 3)
        comment = arguments.get("comment", "")
        session_id = arguments.get("session_id", "")
        agent_id = ""
        try:
            from backend.services.feedback_service import feedback_service
            result = feedback_service.submit(agent_id=agent_id, session_id=session_id,
                target_type=target_type, target_id=target_id,
                rating=max(1, min(5, int(rating))), comment=comment)
            if result.get("success"):
                return f"反馈已记录 (ID: {result['id']})"
            else:
                return f"反馈提交失败: {result.get('error', 'unknown')}"
        except Exception as e:
            return f"反馈提交失败: {e}"

    registry.register_tool(
        name="submit_feedback",
        description="提交用户反馈。当用户对某条知识、规则或 AI 回复表达满意/不满意时调用。评分 1-5。",
        handler=handler,
        input_schema={
            "type": "object",
            "properties": {
                "target_type": {"type": "string", "enum": ["knowledge", "rule", "experience", "memory", "response"]},
                "target_id": {"type": "string", "description": "目标 ID"},
                "rating": {"type": "integer", "minimum": 1, "maximum": 5},
                "comment": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["target_type", "rating"],
        },
    )