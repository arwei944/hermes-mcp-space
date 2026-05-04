# -*- coding: utf-8 -*-
"""智能自动审核 — 基于置信度、风险检测和规则匹配自动审核待处理项"""

import re
from typing import List, Optional

from backend.mcp.tools._base import register_tool, success_response, error_response


# 敏感模式：匹配密码、密钥、令牌等
_SENSITIVE_PATTERNS = [
    re.compile(r"password\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"api[_-]?key\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"secret\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"token\s*[:=]\s*\S+", re.IGNORECASE),
    re.compile(r"credential\s*[:=]\s*\S+", re.IGNORECASE),
    # 长字母数字字符串（可能是硬编码的密钥/令牌）
    re.compile(r"\b[A-Za-z0-9_\-]{32,}\b"),
]


def _detect_risk(content: str) -> dict:
    """
    检测内容中的风险模式

    Returns:
        {"risk_detected": bool, "risk_level": "none"|"low"|"high", "matched_patterns": list}
    """
    if not content:
        return {"risk_detected": False, "risk_level": "none", "matched_patterns": []}

    matched = []
    for pattern in _SENSITIVE_PATTERNS:
        if pattern.search(content):
            matched.append(pattern.pattern)

    if len(matched) >= 2:
        return {"risk_detected": True, "risk_level": "high", "matched_patterns": matched}
    elif len(matched) == 1:
        return {"risk_detected": True, "risk_level": "low", "matched_patterns": matched}
    else:
        return {"risk_detected": False, "risk_level": "none", "matched_patterns": []}


def _evaluate_decision(
    review: dict,
    strategy: str,
    auto_approve_threshold: float,
    auto_reject_threshold: float,
    allowed_categories: Optional[List[str]],
) -> dict:
    """
    对单个审核项做出决策

    Returns:
        {"decision": "approve"|"reject"|"manual", "reason": str, "confidence": float, "risk": dict}
    """
    confidence = float(review.get("confidence", 0.5))
    content = review.get("content", "") or ""
    target_type = review.get("target_type", "")
    title = review.get("title", "") or ""
    reason = review.get("reason", "") or ""

    # 合并所有文本内容用于风险检测
    full_text = f"{title} {content} {reason}"
    risk = _detect_risk(full_text)

    # 检查目标类型是否在允许的类别中
    category_ok = True
    if allowed_categories:
        category_ok = target_type in allowed_categories

    # 根据策略做出决策
    if strategy == "conservative":
        if confidence >= 0.9 and not risk["risk_detected"] and category_ok:
            return {
                "decision": "approve",
                "reason": f"保守策略通过: 置信度 {confidence:.2f} >= 0.9, 无风险, 类别 {target_type}",
                "confidence": confidence,
                "risk": risk,
            }
        elif risk["risk_level"] == "high":
            return {
                "decision": "reject",
                "reason": f"保守策略拒绝: 检测到高风险模式 {risk['matched_patterns']}",
                "confidence": confidence,
                "risk": risk,
            }
        else:
            return {
                "decision": "manual",
                "reason": f"保守策略转人工: 置信度 {confidence:.2f} < 0.9 或存在低风险",
                "confidence": confidence,
                "risk": risk,
            }

    elif strategy == "balanced":
        if confidence >= auto_approve_threshold and not risk["risk_detected"] and category_ok:
            return {
                "decision": "approve",
                "reason": f"均衡策略通过: 置信度 {confidence:.2f} >= {auto_approve_threshold}, 无风险",
                "confidence": confidence,
                "risk": risk,
            }
        elif confidence < auto_reject_threshold or risk["risk_level"] == "high":
            return {
                "decision": "reject",
                "reason": f"均衡策略拒绝: 置信度 {confidence:.2f} < {auto_reject_threshold} 或高风险",
                "confidence": confidence,
                "risk": risk,
            }
        else:
            return {
                "decision": "manual",
                "reason": f"均衡策略转人工: 置信度在阈值之间或存在低风险",
                "confidence": confidence,
                "risk": risk,
            }

    elif strategy == "aggressive":
        if risk["risk_level"] == "high":
            return {
                "decision": "reject",
                "reason": f"激进策略拒绝: 检测到高风险模式 {risk['matched_patterns']}",
                "confidence": confidence,
                "risk": risk,
            }
        elif not risk["risk_detected"] and category_ok:
            return {
                "decision": "approve",
                "reason": f"激进策略通过: 无风险检测, 类别 {target_type}",
                "confidence": confidence,
                "risk": risk,
            }
        else:
            return {
                "decision": "manual",
                "reason": f"激进策略转人工: 存在低风险或类别不在允许列表中",
                "confidence": confidence,
                "risk": risk,
            }

    else:
        return {
            "decision": "manual",
            "reason": f"未知策略: {strategy}, 转人工审核",
            "confidence": confidence,
            "risk": risk,
        }


def register(reg):
    register_tool(
        reg,
        name="auto_review",
        description="智能自动审核待处理项，基于置信度、风险检测和规则匹配进行自动审核决策。支持保守、均衡、激进三种策略。",
        schema={
            "type": "object",
            "properties": {
                "strategy": {
                    "type": "string",
                    "enum": ["conservative", "balanced", "aggressive"],
                    "default": "balanced",
                    "description": "审核策略: conservative 保守 / balanced 均衡 / aggressive 激进",
                },
                "auto_approve_threshold": {
                    "type": "number",
                    "default": 0.8,
                    "description": "自动通过置信度阈值 (0-1)",
                },
                "auto_reject_threshold": {
                    "type": "number",
                    "default": 0.3,
                    "description": "自动拒绝置信度阈值 (0-1)",
                },
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "限制处理的类别列表，如 ['memory', 'knowledge', 'experience', 'rule']",
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "试运行模式，仅分析不执行审核操作",
                },
                "limit": {
                    "type": "integer",
                    "default": 50,
                    "description": "处理数量上限",
                },
            },
        },
        handler=handle,
        tags=["review"],
    )


def handle(args: dict) -> dict:
    from backend.services.review_service import ReviewService

    try:
        svc = ReviewService()
        strategy = args.get("strategy", "balanced")
        auto_approve_threshold = float(args.get("auto_approve_threshold", 0.8))
        auto_reject_threshold = float(args.get("auto_reject_threshold", 0.3))
        categories = args.get("categories")
        dry_run = args.get("dry_run", False)
        limit = int(args.get("limit", 50))

        # 参数校验
        if not (0 <= auto_approve_threshold <= 1):
            return error_response("auto_approve_threshold 必须在 0 到 1 之间")
        if not (0 <= auto_reject_threshold <= 1):
            return error_response("auto_reject_threshold 必须在 0 到 1 之间")
        if auto_approve_threshold <= auto_reject_threshold:
            return error_response("auto_approve_threshold 必须大于 auto_reject_threshold")

        # 查询待处理审核项
        pending_reviews = svc.list_reviews(status="pending", limit=limit)

        # 按类别过滤
        if categories:
            pending_reviews = [
                r for r in pending_reviews if r.get("target_type") in categories
            ]

        if not pending_reviews:
            return success_response(
                data={
                    "total": 0,
                    "approved": 0,
                    "rejected": 0,
                    "manual": 0,
                    "details": [],
                },
                message="没有待处理的审核项",
            )

        # 逐项评估
        details = []
        approved_count = 0
        rejected_count = 0
        manual_count = 0

        for review in pending_reviews:
            evaluation = _evaluate_decision(
                review=review,
                strategy=strategy,
                auto_approve_threshold=auto_approve_threshold,
                auto_reject_threshold=auto_reject_threshold,
                allowed_categories=categories,
            )

            detail = {
                "review_id": review.get("id"),
                "target_type": review.get("target_type"),
                "action": review.get("action"),
                "title": review.get("title"),
                "confidence": evaluation["confidence"],
                "decision": evaluation["decision"],
                "reason": evaluation["reason"],
                "risk": evaluation["risk"],
            }

            # 非试运行模式下执行审核操作
            if not dry_run:
                review_id = review.get("id")
                if evaluation["decision"] == "approve":
                    result = svc.approve_review(
                        review_id,
                        reviewed_by="auto_review",
                        review_note=evaluation["reason"],
                    )
                    detail["executed"] = result is not None and result.get("status") == "approved"
                elif evaluation["decision"] == "reject":
                    result = svc.reject_review(
                        review_id,
                        reviewed_by="auto_review",
                        review_note=evaluation["reason"],
                    )
                    detail["executed"] = result is not None and result.get("status") == "rejected"
                else:
                    detail["executed"] = False

            details.append(detail)

            if evaluation["decision"] == "approve":
                approved_count += 1
            elif evaluation["decision"] == "reject":
                rejected_count += 1
            else:
                manual_count += 1

        mode_label = "试运行" if dry_run else "正式执行"
        summary = {
            "total": len(pending_reviews),
            "approved": approved_count,
            "rejected": rejected_count,
            "manual": manual_count,
            "strategy": strategy,
            "dry_run": dry_run,
            "details": details,
        }

        return success_response(
            data=summary,
            message=f"自动审核完成 ({mode_label}): 共 {len(pending_reviews)} 项, "
                    f"通过 {approved_count}, 拒绝 {rejected_count}, 转人工 {manual_count}",
        )
    except Exception as e:
        return error_response(str(e))
