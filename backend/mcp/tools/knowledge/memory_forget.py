# -*- coding: utf-8 -*-
"""删除/归档记忆（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="memory_forget",
        description="删除/归档记忆（需审核）",
        schema={
            "type": "object",
            "properties": {
                "mem_id": {"type": "string", "description": "记忆 ID"},
                "reason": {"type": "string", "description": "删除原因"},
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

        review = review_svc.submit_review(
            target_type="memory",
            action="delete",
            title=f"删除记忆: {mem['title']}",
            content="",
            old_content=mem["content"],
            reason=args.get("reason", "AI 请求遗忘"),
            target_id=args["mem_id"],
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="记忆删除已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
