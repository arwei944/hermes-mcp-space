# -*- coding: utf-8 -*-
"""列出审核项"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="review_list",
        description="列出审核项",
        schema={
            "type": "object",
            "properties": {
                "status": {"type": "string", "default": "pending", "description": "审核状态筛选"},
                "limit": {"type": "integer", "default": 50, "description": "返回数量上限"},
            },
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.review_service import ReviewService

    try:
        svc = ReviewService()
        items = svc.list_reviews(
            status=args.get("status", "pending"),
            limit=args.get("limit", 50),
        )
        return success_response(
            data=items,
            message=f"共 {len(items)} 条审核记录",
        )
    except Exception as e:
        return error_response(str(e))
