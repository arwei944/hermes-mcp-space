# -*- coding: utf-8 -*-
"""创建知识条目（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response

import json


def register(reg):
    register_tool(
        reg,
        name="knowledge_create",
        description="创建知识条目（需审核）",
        schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "标题"},
                "content": {"type": "string", "description": "内容"},
                "summary": {"type": "string", "description": "摘要"},
                "category": {"type": "string", "default": "general", "description": "分类"},
                "tags": {"type": "string", "description": "标签（逗号分隔）"},
                "source": {"type": "string", "default": "ai_extracted", "description": "来源"},
                "source_ref": {"type": "string", "description": "来源引用"},
                "confidence": {"type": "number", "default": 0.8, "description": "置信度"},
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
                "summary": args.get("summary", ""),
                "category": args.get("category", "general"),
                "tags": tag_list,
                "source": args.get("source", "ai_extracted"),
                "source_ref": args.get("source_ref", ""),
                "confidence": args.get("confidence", 0.8),
            },
            ensure_ascii=False,
        )
        review = review_svc.submit_review(
            target_type="knowledge",
            action="create",
            title=args["title"],
            content=payload,
            reason=args.get("reason", ""),
            confidence=args.get("confidence", 0.8),
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="知识条目已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
