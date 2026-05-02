# -*- coding: utf-8 -*-
"""删除知识条目（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="knowledge_delete",
        description="删除知识条目（需审核）",
        schema={
            "type": "object",
            "properties": {
                "knowledge_id": {"type": "string", "description": "知识 ID"},
                "reason": {"type": "string", "description": "删除原因"},
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

        review = review_svc.submit_review(
            target_type="knowledge",
            action="delete",
            title=f"删除知识: {kn['title']}",
            content="",
            old_content=kn["content"],
            reason=args.get("reason", "AI 请求删除"),
            target_id=args["knowledge_id"],
            priority="urgent",
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="知识删除已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
