# -*- coding: utf-8 -*-
"""记录新经验（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response

import json


def register(reg):
    register_tool(
        reg,
        name="experience_create",
        description="记录新经验（需审核）",
        schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "标题"},
                "content": {"type": "string", "description": "内容"},
                "category": {"type": "string", "default": "best_practice", "description": "分类"},
                "context": {"type": "string", "description": "上下文"},
                "tool_name": {"type": "string", "description": "相关工具"},
                "error_type": {"type": "string", "description": "错误类型"},
                "severity": {"type": "string", "default": "medium", "description": "严重程度"},
                "tags": {"type": "string", "description": "标签（逗号分隔）"},
                "reason": {"type": "string", "description": "创建原因"},
            },
            "required": ["title", "content"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.review_service import ReviewService

    try:
        review_svc = ReviewService()
        tag_list = (
            [t.strip() for t in args.get("tags", "").split(",") if t.strip()]
            if args.get("tags")
            else []
        )
        payload = json.dumps(
            {
                "title": args["title"],
                "content": args["content"],
                "category": args.get("category", "best_practice"),
                "context": args.get("context", ""),
                "tool_name": args.get("tool_name", ""),
                "error_type": args.get("error_type", ""),
                "severity": args.get("severity", "medium"),
                "tags": tag_list,
            },
            ensure_ascii=False,
        )
        review = review_svc.submit_review(
            target_type="experience",
            action="create",
            title=args["title"],
            content=payload,
            reason=args.get("reason", ""),
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="经验记录已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
