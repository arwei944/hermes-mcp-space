# -*- coding: utf-8 -*-
"""创建新记忆（需审核）"""

import json

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="memory_create",
        description="创建新记忆（需审核）",
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "记忆内容"},
                "category": {"type": "string", "default": "agent_memory", "description": "分类"},
                "title": {"type": "string", "description": "标题"},
                "importance": {"type": "integer", "default": 5, "description": "重要度"},
                "tags": {"type": "string", "description": "标签（逗号分隔）"},
                "reason": {"type": "string", "description": "创建原因"},
            },
            "required": ["content"],
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
                "content": args["content"],
                "category": args.get("category", "agent_memory"),
                "title": args.get("title", ""),
                "importance": args.get("importance", 5),
                "tags": tag_list,
            },
            ensure_ascii=False,
        )
        review = review_svc.submit_review(
            target_type="memory",
            action="create",
            title=args.get("title", "") or args["content"][:50],
            content=payload,
            reason=args.get("reason", ""),
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="记忆创建已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
