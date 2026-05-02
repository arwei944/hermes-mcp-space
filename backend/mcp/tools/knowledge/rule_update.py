# -*- coding: utf-8 -*-
"""更新规则（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response

import json


def register(reg):
    register_tool(
        reg,
        name="rule_update",
        description="更新规则（需审核）",
        schema={
            "type": "object",
            "properties": {
                "rule_id": {"type": "string", "description": "规则 ID"},
                "title": {"type": "string", "description": "新标题"},
                "content": {"type": "string", "description": "新内容"},
                "category": {"type": "string", "description": "新分类"},
                "priority": {"type": "integer", "description": "新优先级"},
                "tags": {"type": "string", "description": "新标签（逗号分隔）"},
                "reason": {"type": "string", "description": "更新原因"},
            },
            "required": ["rule_id"],
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

        rule = knowledge_svc.get_rule(args["rule_id"])
        if not rule:
            return error_response(f"规则 {args['rule_id']} 不存在")

        updates = {}
        if args.get("title"):
            updates["title"] = args["title"]
        if args.get("content"):
            updates["content"] = args["content"]
        if args.get("category"):
            updates["category"] = args["category"]
        if args.get("priority", 0) > 0:
            updates["priority"] = args["priority"]
        if args.get("tags"):
            updates["tags"] = [t.strip() for t in args["tags"].split(",") if t.strip()]

        review = review_svc.submit_review(
            target_type="rule",
            action="update",
            title=f"更新规则: {rule['title']}",
            content=json.dumps(updates, ensure_ascii=False),
            old_content=json.dumps(
                {"title": rule["title"], "content": rule["content"]}, ensure_ascii=False
            ),
            reason=args.get("reason", ""),
            target_id=args["rule_id"],
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="规则更新已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
