# -*- coding: utf-8 -*-
"""获取审核统计"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="review_stats",
        description="获取审核统计",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.review_service import ReviewService

    try:
        svc = ReviewService()
        stats = svc.get_review_stats()
        return success_response(data=stats)
    except Exception as e:
        return error_response(str(e))
