# -*- coding: utf-8 -*-
"""标记经验为已解决（需审核）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="experience_resolve",
        description="标记经验为已解决（需审核）",
        schema={
            "type": "object",
            "properties": {
                "exp_id": {"type": "string", "description": "经验 ID"},
                "reason": {"type": "string", "description": "解决原因"},
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

        review = review_svc.submit_review(
            target_type="experience",
            action="resolve",
            title=f"标记已解决: {exp['title']}",
            content="",
            old_content=exp["content"],
            reason=args.get("reason", "AI 判断问题已解决"),
            target_id=args["exp_id"],
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="经验解决标记已提交审核",
        )
    except Exception as e:
        return error_response(str(e))
