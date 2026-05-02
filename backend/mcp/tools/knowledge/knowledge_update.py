# -*- coding: utf-8 -*-
"""更新知识条目（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response

import json


def register(reg):
    register_tool(
        reg,
        name="knowledge_update",
        description="更新知识条目（需审核）",
        schema={
            "type": "object",
            "properties": {
                "knowledge_id": {"type": "string", "description": "知识 ID"},
                "title": {"type": "string", "description": "新标题"},
                "content": {"type": "string", "description": "新内容"},
                "summary": {"type": "string", "description": "新摘要"},
                "category": {"type": "string", "description": "新分类"},
                "tags": {"type": "string", "description": "新标签（逗号分隔）"},
                "reason": {"type": "string", "description": "更新原因"},
            },
            "required": ["knowledge_id"],
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

        kn = knowledge_svc.get_knowledge(args["knowledge_id"])
        if not kn:
            return error_response(f"知识 {args['knowledge_id']} 不存在")

        updates = {}
        if args.get("title"):
            updates["title"] = args["title"]
        if args.get("content"):
            updates["content"] = args["content"]
        if args.get("summary"):
            updates["summary"] = args["summary"]
        if args.get("category"):
            updates["category"] = args["category"]
        if args.get("tags"):
            updates["tags"] = [t.strip() for t in args["tags"].split(",") if t.strip()]

        review = review_svc.submit_review(
            target_type="knowledge",
            action="update",
            title=f"更新知识: {kn['title']}",
            content=json.dumps(updates, ensure_ascii=False),
            old_content=json.dumps(
                {"title": kn["title"], "content": kn["content"]}, ensure_ascii=False
            ),
            reason=args.get("reason", ""),
            target_id=args["knowledge_id"],
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="知识更新已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
