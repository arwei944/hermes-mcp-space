# -*- coding: utf-8 -*-
"""创建规则（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response

import json


def register(reg):
    register_tool(
        reg,
        name="rule_create",
        description="创建规则（需审核）",
        schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "规则标题"},
                "content": {"type": "string", "description": "规则内容"},
                "category": {"type": "string", "default": "general", "description": "分类"},
                "priority": {"type": "integer", "default": 5, "description": "优先级"},
                "scope": {"type": "string", "default": "global", "description": "作用范围"},
                "tags": {"type": "string", "description": "标签（逗号分隔）"},
                "reason": {"type": "string", "description": "创建原因"},
            },
            "required": ["title", "content"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService
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
                "category": args.get("category", "general"),
                "priority": args.get("priority", 5),
                "scope": args.get("scope", "global"),
                "tags": tag_list,
            },
            ensure_ascii=False,
        )
        review = review_svc.submit_review(
            target_type="rule",
            action="create",
            title=args["title"],
            content=payload,
            reason=args.get("reason", ""),
            confidence=0.9,
            priority="normal",
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="规则已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
