# -*- coding: utf-8 -*-
"""更新记忆（需审核）"""

import json

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="memory_update",
        description="更新记忆（需审核）",
        schema={
            "type": "object",
            "properties": {
                "mem_id": {"type": "string", "description": "记忆 ID"},
                "content": {"type": "string", "description": "新内容"},
                "importance": {"type": "integer", "description": "新重要度"},
                "tags": {"type": "string", "description": "新标签（逗号分隔）"},
                "reason": {"type": "string", "description": "更新原因"},
            },
            "required": ["mem_id"],
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

        mem = knowledge_svc.get_memory(args["mem_id"])
        if not mem:
            return error_response(f"记忆 {args['mem_id']} 不存在")

        updates = {}
        if args.get("content"):
            updates["content"] = args["content"]
        if args.get("importance", 0) > 0:
            updates["importance"] = args["importance"]
        if args.get("tags"):
            updates["tags"] = [t.strip() for t in args["tags"].split(",") if t.strip()]

        review = review_svc.submit_review(
            target_type="memory",
            action="update",
            title=f"更新记忆: {mem['title']}",
            content=json.dumps(updates, ensure_ascii=False),
            old_content=mem["content"],
            reason=args.get("reason", ""),
            target_id=args["mem_id"],
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="记忆更新已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
