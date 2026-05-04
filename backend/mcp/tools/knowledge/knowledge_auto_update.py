# -*- coding: utf-8 -*-
"""检查知识条目并根据使用模式和时效性生成更新建议"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="knowledge_auto_update",
        description="检查知识条目的时效性和使用模式，自动生成更新建议。可按来源过滤，支持建议删除、内容刷新和置信度重评估。",
        schema={
            "type": "object",
            "properties": {
                "sources": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "限定来源过滤，如 ['ai_extracted', 'web_import', 'conversation', 'manual']",
                },
                "auto_approve": {
                    "type": "boolean",
                    "default": False,
                    "description": "是否自动执行更新操作（否则仅生成建议）",
                },
                "limit": {
                    "type": "integer",
                    "default": 50,
                    "description": "分析的知识条目数量上限",
                },
            },
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService
    from backend.services.search_service import SearchService
    from datetime import datetime, timedelta

    try:
        knowledge_svc = KnowledgeService()
        search_svc = SearchService()

        sources = args.get("sources")
        auto_approve = args.get("auto_approve", False)
        limit = int(args.get("limit", 50))

        if limit < 1:
            return error_response("limit 必须大于 0")

        # 1. 获取知识条目
        all_knowledge = knowledge_svc.list_knowledge(is_active=True)

        # 按来源过滤
        if sources:
            all_knowledge = [
                kn for kn in all_knowledge
                if kn.get("source") in sources
            ]

        # 限制数量
        all_knowledge = all_knowledge[:limit]
        total_analyzed = len(all_knowledge)

        if total_analyzed == 0:
            return success_response(
                data={
                    "total_analyzed": 0,
                    "suggestions": [],
                },
                message="没有匹配的知识条目",
            )

        now = datetime.now()
        suggestions = []
        actions_taken = []

        for kn in all_knowledge:
            kn_id = kn.get("id")
            title = kn.get("title", "")
            view_count = int(kn.get("view_count", 0))
            confidence = float(kn.get("confidence", 0.5))
            created_at_str = kn.get("created_at", "")
            updated_at_str = kn.get("updated_at") or created_at_str
            tags = kn.get("tags", []) or []

            # 解析创建时间
            try:
                if isinstance(created_at_str, datetime):
                    created_at = created_at_str
                else:
                    created_at = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00").replace("+00:00", ""))
            except (ValueError, TypeError):
                created_at = now

            age_days = (now - created_at).days

            # 2. 分析并生成建议

            # 建议1: 30+天零访问 -> 建议审核删除
            if view_count == 0 and age_days >= 30:
                suggestion = {
                    "knowledge_id": kn_id,
                    "title": title,
                    "suggestion_type": "review_for_deletion",
                    "reason": f"创建已 {age_days} 天，零访问记录，建议审核是否删除",
                    "current_stats": {
                        "view_count": view_count,
                        "age_days": age_days,
                        "confidence": confidence,
                    },
                }
                suggestions.append(suggestion)

                if auto_approve:
                    try:
                        knowledge_svc.update_knowledge(kn_id, is_active=False)
                        actions_taken.append({
                            "action": "deactivated",
                            "knowledge_id": kn_id,
                            "reason": suggestion["reason"],
                        })
                    except Exception:
                        pass

            # 建议2: 高访问但内容老旧 -> 建议内容刷新
            elif view_count > 10 and age_days >= 60:
                suggestion = {
                    "knowledge_id": kn_id,
                    "title": title,
                    "suggestion_type": "content_refresh",
                    "reason": f"访问量 {view_count} 次但内容已 {age_days} 天未更新，建议刷新内容",
                    "current_stats": {
                        "view_count": view_count,
                        "age_days": age_days,
                        "confidence": confidence,
                    },
                }
                suggestions.append(suggestion)

            # 建议3: 低置信度 -> 建议重新评估
            if confidence < 0.4:
                suggestion = {
                    "knowledge_id": kn_id,
                    "title": title,
                    "suggestion_type": "confidence_re_evaluation",
                    "reason": f"置信度 {confidence:.2f} 过低，建议重新评估内容准确性",
                    "current_stats": {
                        "view_count": view_count,
                        "age_days": age_days,
                        "confidence": confidence,
                    },
                }
                suggestions.append(suggestion)

                if auto_approve:
                    try:
                        knowledge_svc.update_knowledge(kn_id, confidence=min(confidence + 0.1, 1.0))
                        actions_taken.append({
                            "action": "confidence_adjusted",
                            "knowledge_id": kn_id,
                            "old_confidence": confidence,
                            "new_confidence": min(confidence + 0.1, 1.0),
                        })
                    except Exception:
                        pass

            # 建议4: 检查标签是否匹配近期搜索模式
            if tags and age_days >= 30:
                try:
                    # 用标题搜索，看是否有近期相关搜索结果
                    search_results = search_svc.search_unified(
                        title, types=["knowledge"], limit=3
                    )
                    # 如果搜索不到自身，说明可能标签/索引有问题
                    found_self = any(
                        sr.get("id") == kn_id for sr in search_results
                    )
                    if not found_self and search_results:
                        suggestion = {
                            "knowledge_id": kn_id,
                            "title": title,
                            "suggestion_type": "reindex_or_retag",
                            "reason": f"搜索自身标题未命中，可能需要重新索引或更新标签。当前标签: {tags}",
                            "current_stats": {
                                "view_count": view_count,
                                "age_days": age_days,
                                "tags": tags,
                            },
                        }
                        suggestions.append(suggestion)
                except Exception:
                    pass

        # 按建议类型统计
        from collections import Counter
        type_counts = Counter(s["suggestion_type"] for s in suggestions)

        mode_label = "自动执行" if auto_approve else "仅建议"
        return success_response(
            data={
                "total_analyzed": total_analyzed,
                "suggestions": suggestions,
                "suggestion_summary": dict(type_counts),
                "actions_taken": actions_taken if auto_approve else [],
            },
            message=f"知识更新分析完成 ({mode_label}): "
                    f"分析 {total_analyzed} 条, "
                    f"生成 {len(suggestions)} 条建议, "
                    f"执行 {len(actions_taken)} 项操作",
        )
    except Exception as e:
        return error_response(str(e))
