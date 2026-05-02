# -*- coding: utf-8 -*-
"""审核通过或拒绝（approve / reject）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="review_approve",
        description="审核通过或拒绝审核项。action 为 approve 时通过，reject 时拒绝。",
        schema={
            "type": "object",
            "properties": {
                "review_id": {"type": "string", "description": "审核记录 ID"},
                "action": {"type": "string", "enum": ["approve", "reject"], "description": "操作类型：approve 通过 / reject 拒绝"},
                "reviewed_by": {"type": "string", "default": "admin", "description": "审核人"},
                "review_note": {"type": "string", "description": "审核备注"},
            },
            "required": ["review_id", "action"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.review_service import ReviewService

    try:
        svc = ReviewService()
        action = args["action"]
        review_id = args["review_id"]
        reviewed_by = args.get("reviewed_by", "admin")
        review_note = args.get("review_note", "")

        if action == "approve":
            result = svc.approve_review(review_id, reviewed_by=reviewed_by, review_note=review_note)
            if not result:
                return error_response(f"审核通过失败，审核项 {review_id} 不存在或状态不是 pending")
            return success_response(data=result, message="审核已通过")
        elif action == "reject":
            result = svc.reject_review(review_id, reviewed_by=reviewed_by, review_note=review_note)
            if not result:
                return error_response(f"审核拒绝失败，审核项 {review_id} 不存在或状态不是 pending")
            return success_response(data=result, message="审核已拒绝")
        else:
            return error_response(f"无效的 action: {action}，必须是 approve 或 reject")
    except Exception as e:
        return error_response(str(e))
