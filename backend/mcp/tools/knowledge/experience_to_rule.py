# -*- coding: utf-8 -*-
"""将高频未解决经验自动转化为规则"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="experience_to_rule",
        description="将高频出现的未解决经验自动转化为规则。按类别分组，综合多条经验生成规则并提交审核。",
        schema={
            "type": "object",
            "properties": {
                "min_occurrences": {
                    "type": "integer",
                    "default": 3,
                    "description": "最低出现次数阈值，仅转化出现次数 >= 此值的高频经验",
                },
                "category": {
                    "type": "string",
                    "description": "限定处理的类别，如 'error_pattern'、'pitfall' 等，不填则处理所有类别",
                },
            },
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

        min_occurrences = int(args.get("min_occurrences", 3))
        category_filter = args.get("category")

        if min_occurrences < 1:
            return error_response("min_occurrences 必须大于 0")

        # 1. 获取所有未解决的经验
        unresolved = knowledge_svc.list_experiences(is_resolved=False, is_active=True)

        # 按类别过滤
        if category_filter:
            unresolved = [
                exp for exp in unresolved
                if exp.get("category") == category_filter
            ]

        # 2. 过滤高频经验（occurrence_count >= min_occurrences）
        high_freq = [
            exp for exp in unresolved
            if int(exp.get("occurrence_count", 0)) >= min_occurrences
        ]

        if not high_freq:
            return success_response(
                data={
                    "converted_count": 0,
                    "rules_submitted": [],
                },
                message=f"没有出现次数 >= {min_occurrences} 的未解决经验",
            )

        # 3. 按类别分组
        from collections import OrderedDict
        groups = OrderedDict()
        for exp in high_freq:
            cat = exp.get("category", "general")
            if cat not in groups:
                groups[cat] = []
            groups[cat].append(exp)

        # 4. 为每个分组综合生成规则并提交审核
        rules_submitted = []
        converted_count = 0

        for cat, experiences in groups.items():
            # 综合标题：取出现次数最高的经验标题作为基础
            experiences_sorted = sorted(
                experiences,
                key=lambda x: int(x.get("occurrence_count", 0)),
                reverse=True,
            )

            # 规则标题：基于类别和最高频经验标题
            base_title = experiences_sorted[0].get("title", "")
            if len(experiences) > 1:
                rule_title = f"[{cat}] {base_title} (综合 {len(experiences)} 条经验)"
            else:
                rule_title = f"[{cat}] {base_title}"

            # 综合内容：合并所有经验的内容
            content_parts = []
            source_exp_ids = []
            for exp in experiences_sorted:
                exp_content = exp.get("content", "")
                exp_id = exp.get("id", "")
                if exp_content:
                    content_parts.append(f"- {exp_content}")
                source_exp_ids.append(exp_id)

            rule_content = (
                f"## 来源经验 (共 {len(experiences)} 条)\n\n"
                + "\n".join(content_parts)
                + f"\n\n## 综合建议\n"
                f"以上 {len(experiences)} 条经验反复出现，建议形成标准化规则。"
            )

            # 根据严重程度确定优先级
            severities = [exp.get("severity", "medium") for exp in experiences]
            if "high" in severities:
                priority = 8
            elif "medium" in severities:
                priority = 6
            else:
                priority = 4

            # 提交审核
            import json
            payload = json.dumps(
                {
                    "title": rule_title,
                    "content": rule_content,
                    "category": "workflow" if cat in ("workflow", "best_practice", "tip") else "priority",
                    "priority": priority,
                    "scope": "global",
                    "tags": [cat, "auto_generated", "experience_derived"],
                    "source_experiences": source_exp_ids,
                },
                ensure_ascii=False,
            )

            review = review_svc.submit_review(
                target_type="rule",
                action="create",
                title=rule_title,
                content=payload,
                reason=f"由 {len(experiences)} 条高频经验自动生成 (类别: {cat}, 最低出现次数: {min_occurrences})",
                confidence=0.7,
                priority="normal",
            )

            rules_submitted.append({
                "title": rule_title,
                "source_experiences": source_exp_ids,
                "experience_count": len(experiences),
                "category": cat,
                "priority": priority,
                "review_id": review.get("id"),
            })
            converted_count += 1

        return success_response(
            data={
                "converted_count": converted_count,
                "rules_submitted": rules_submitted,
            },
            message=f"经验转规则完成: {len(high_freq)} 条高频经验分为 {converted_count} 组, "
                    f"已提交 {converted_count} 条规则审核",
        )
    except Exception as e:
        return error_response(str(e))
