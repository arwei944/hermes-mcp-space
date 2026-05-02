# -*- coding: utf-8 -*-
"""删除规则（需审核，高风险）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="rule_delete",
        description="删除规则（需审核，高风险）",
        schema={
            "type": "object",
            "properties": {
                "rule_id": {"type": "string", "description": "规则 ID"},
                "reason": {"type": "string", "description": "删除原因"},
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

        review = review_svc.submit_review(
            target_type="rule",
            action="delete",
            title=f"删除规则: {rule['title']}",
            content="",
            old_content=rule["content"],
            reason=args.get("reason", "AI 请求删除"),
            target_id=args["rule_id"],
            priority="urgent",
        )
        return success_response(
            data={"review_id": review["id"], "status": "pending"},
            message="规则删除已提交审核（高风险）",
        )
    except Exception as e:
        return error_response(str(e))
