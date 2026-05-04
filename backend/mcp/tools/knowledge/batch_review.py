# -*- coding: utf-8 -*-
"""批量审核 — 批量处理待审核项，支持全部通过、全部拒绝或智能审核"""

from typing import List, Optional

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="batch_review",
        description="批量审核待处理项，支持全部通过、全部拒绝或智能审核。可按类别或指定 ID 过滤。",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["approve_all", "reject_all", "smart_review"],
                    "description": "批量操作类型: approve_all 全部通过 / reject_all 全部拒绝 / smart_review 智能审核",
                },
                "category_filter": {
                    "type": "string",
                    "enum": ["memory", "knowledge", "experience", "rule"],
                    "description": "按目标类别过滤审核项",
                },
                "review_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "指定要处理的审核 ID 列表（优先于 category_filter）",
                },
                "reason": {
                    "type": "string",
                    "description": "操作原因，用于审计追踪",
                },
            },
            "required": ["action"],
        },
        handler=handle,
        tags=["review"],
    )


def handle(args: dict) -> dict:
    from backend.services.review_service import ReviewService

    try:
        svc = ReviewService()
        action = args["action"]
        category_filter = args.get("category_filter")
        review_ids = args.get("review_ids")
        reason = args.get("reason", "")

        # 获取待处理审核项
        if review_ids:
            # 按 ID 过滤：先查全部 pending，再筛选匹配的 ID
            all_pending = svc.list_reviews(status="pending", limit=10000)
            target_reviews = [r for r in all_pending if r.get("id") in review_ids]
        elif category_filter:
            target_reviews = svc.list_reviews(status="pending", target_type=category_filter, limit=10000)
        else:
            target_reviews = svc.list_reviews(status="pending", limit=10000)

        if not target_reviews:
            return success_response(
                data={
                    "action": action,
                    "total": 0,
                    "processed": 0,
                    "failed": 0,
                    "details": [],
                },
                message="没有匹配的待处理审核项",
            )

        # 构建审计备注
        audit_reason = reason or f"批量操作: {action}"
        if category_filter:
            audit_reason += f" (类别: {category_filter})"

        # 根据操作类型执行
        if action == "approve_all":
            result = _batch_approve(svc, target_reviews, audit_reason)
        elif action == "reject_all":
            result = _batch_reject(svc, target_reviews, audit_reason)
        elif action == "smart_review":
            result = _smart_review(svc, target_reviews)
        else:
            return error_response(f"无效的 action: {action}")

        return success_response(
            data=result,
            message=f"批量审核完成: {action}, 共 {result['total']} 项, "
                    f"处理 {result['processed']} 项, 失败 {result['failed']} 项",
        )
    except Exception as e:
        return error_response(str(e))


def _batch_approve(svc, reviews: list, reason: str) -> dict:
    """批量通过审核"""
    review_ids = [r["id"] for r in reviews]
    batch_result = svc.batch_approve(review_ids, reviewed_by="batch_review")

    details = []
    for review in reviews:
        details.append({
            "review_id": review.get("id"),
            "target_type": review.get("target_type"),
            "title": review.get("title"),
            "action": "approve",
            "reason": reason,
        })

    return {
        "action": "approve_all",
        "total": len(reviews),
        "processed": batch_result["approved"],
        "failed": batch_result["failed"],
        "details": details,
    }


def _batch_reject(svc, reviews: list, reason: str) -> dict:
    """批量拒绝审核"""
    review_ids = [r["id"] for r in reviews]
    batch_result = svc.batch_reject(review_ids, reviewed_by="batch_review")

    details = []
    for review in reviews:
        details.append({
            "review_id": review.get("id"),
            "target_type": review.get("target_type"),
            "title": review.get("title"),
            "action": "reject",
            "reason": reason,
        })

    return {
        "action": "reject_all",
        "total": len(reviews),
        "processed": batch_result["rejected"],
        "failed": batch_result["failed"],
        "details": details,
    }


def _smart_review(svc, reviews: list) -> dict:
    """智能审核：委托给 auto_review 的评估逻辑"""
    from backend.mcp.tools.knowledge.auto_review import _evaluate_decision

    details = []
    approved = 0
    rejected = 0
    manual = 0

    for review in reviews:
        evaluation = _evaluate_decision(
            review=review,
            strategy="balanced",
            auto_approve_threshold=0.8,
            auto_reject_threshold=0.3,
            allowed_categories=None,
        )

        review_id = review.get("id")
        executed = False

        if evaluation["decision"] == "approve":
            result = svc.approve_review(
                review_id,
                reviewed_by="batch_smart_review",
                review_note=evaluation["reason"],
            )
            executed = result is not None and result.get("status") == "approved"
            if executed:
                approved += 1
        elif evaluation["decision"] == "reject":
            result = svc.reject_review(
                review_id,
                reviewed_by="batch_smart_review",
                review_note=evaluation["reason"],
            )
            executed = result is not None and result.get("status") == "rejected"
            if executed:
                rejected += 1
        else:
            manual += 1

        details.append({
            "review_id": review_id,
            "target_type": review.get("target_type"),
            "title": review.get("title"),
            "decision": evaluation["decision"],
            "reason": evaluation["reason"],
            "executed": executed,
        })

    return {
        "action": "smart_review",
        "total": len(reviews),
        "processed": approved + rejected,
        "failed": len(reviews) - approved - rejected - manual,
        "approved": approved,
        "rejected": rejected,
        "manual": manual,
        "details": details,
    }
