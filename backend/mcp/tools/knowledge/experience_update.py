# -*- coding: utf-8 -*-
"""更新经验（需审核）"""

import json

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="experience_update",
        description="更新经验（需审核）",
        schema={
            "type": "object",
            "properties": {
                "exp_id": {"type": "string", "description": "经验 ID"},
                "title": {"type": "string", "description": "新标题"},
                "content": {"type": "string", "description": "新内容"},
                "category": {"type": "string", "description": "新分类"},
                "tags": {"type": "string", "description": "新标签（逗号分隔）"},
                "reason": {"type": "string", "description": "更新原因"},
            },
            "required": ["exp_id"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService
    from backend.services.review_service import ReviewService

    try:
        knowledge_svc = KnowledgeService()
        review_svc = ReviewService()

        exp = knowledge_svc.get_experience(args["exp_id"])
        if not exp:
            return error_response(f"经验 {args['exp_id']} 不存在")

        updates = {}
        if args.get("title"):
            updates["title"] = args["title"]
        if args.get("content"):
            updates["content"] = args["content"]
        if args.get("category"):
            updates["category"] = args["category"]
        if args.get("tags"):
            updates["tags"] = [t.strip() for t in args["tags"].split(",") if t.strip()]

        review = review_svc.submit_review(
            target_type="experience",
            action="update",
            title=f"更新经验: {exp['title']}",
            content=json.dumps(updates, ensure_ascii=False),
            old_content=exp["content"],
            reason=args.get("reason", ""),
            target_id=args["exp_id"],
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="经验更新已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
