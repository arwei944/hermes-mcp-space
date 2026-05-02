# -*- coding: utf-8 -*-
"""从对话中提取知识（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response

import json


def register(reg):
    register_tool(
        reg,
        name="knowledge_extract",
        description="从对话中提取知识（需审核）",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "会话 ID"},
                "reason": {"type": "string", "description": "提取原因"},
            },
            "required": ["session_id"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.hermes_service import hermes_service as _hs
    from backend.services.review_service import ReviewService

    try:
        review_svc = ReviewService()

        messages = _hs.get_session_messages(args["session_id"])
        if not messages:
            return error_response(f"会话 {args['session_id']} 无消息")

        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]
        if not assistant_msgs:
            return error_response("会话中无 assistant 回复")

        extracted = [
            msg.get("content", "")[:500]
            for msg in assistant_msgs[:5]
            if msg.get("content", "")
        ]
        payload = json.dumps(
            {
                "title": f"从会话 {args['session_id'][:12]} 提取的知识",
                "content": "\n\n---\n\n".join(extracted),
                "category": "general",
                "tags": ["auto-extracted"],
                "source": "session",
                "source_ref": args["session_id"],
                "confidence": 0.6,
            },
            ensure_ascii=False,
        )
        review = review_svc.submit_review(
            target_type="knowledge",
            action="create",
            title=f"从会话提取知识: {args['session_id'][:12]}",
            content=payload,
            reason=args.get("reason", "AI 自动从对话中提取知识"),
            confidence=0.6,
            session_id=args["session_id"],
        )
        return success_response(
            data={
                "review_id": review["id"],
                "status": "pending",
                "extracted_count": len(extracted),
            },
            message="知识提取已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
