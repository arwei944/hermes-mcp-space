# -*- coding: utf-8 -*-
"""自动检查并解决已有对应规则/知识/技能覆盖的经验条目"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="auto_resolve_experience",
        description="自动检查未解决的经验条目，搜索是否有对应的规则/知识/技能已覆盖。支持按类别过滤、试运行和自动解决。",
        schema={
            "type": "object",
            "properties": {
                "check_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "限定检查的经验类别，如 ['best_practice', 'error_pattern', 'pitfall', 'tip', 'workflow']",
                },
                "auto_resolve": {
                    "type": "boolean",
                    "default": True,
                    "description": "是否自动标记已覆盖的经验为已解决",
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "试运行模式，仅检测不执行解决操作",
                },
            },
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService
    from backend.services.search_service import SearchService

    try:
        knowledge_svc = KnowledgeService()
        search_svc = SearchService()

        check_categories = args.get("check_categories")
        auto_resolve = args.get("auto_resolve", True)
        dry_run = args.get("dry_run", False)

        # 1. 获取所有未解决且活跃的经验
        unresolved = knowledge_svc.list_experiences(is_resolved=False, is_active=True)

        # 按类别过滤
        if check_categories:
            unresolved = [
                exp for exp in unresolved
                if exp.get("category") in check_categories
            ]

        total_unresolved = len(unresolved)

        if total_unresolved == 0:
            return success_response(
                data={
                    "total_unresolved": 0,
                    "resolved_count": 0,
                    "already_covered_details": [],
                },
                message="没有未解决的经验条目",
            )

        # 2. 逐条检查是否已被知识/规则覆盖
        already_covered_details = []
        resolved_count = 0

        for exp in unresolved:
            exp_id = exp.get("id")
            title = exp.get("title", "")
            content = exp.get("content", "")

            # 提取搜索关键词：标题 + 内容前100字
            search_query = title
            if content:
                search_query = f"{title} {content[:100]}"

            # 搜索知识库和规则
            matched = False
            matched_by = ""
            matched_item = ""

            # 搜索知识
            try:
                knowledge_results = search_svc.search_single_type(
                    "knowledge", search_query, limit=5
                )
                for kr in knowledge_results:
                    if float(kr.get("score", 0)) > 0.3:
                        matched = True
                        matched_by = "knowledge"
                        matched_item = kr.get("title", kr.get("id", ""))
                        break
            except Exception:
                pass

            # 搜索规则
            if not matched:
                try:
                    rule_results = search_svc.search_single_type(
                        "rules", search_query, limit=5
                    )
                    for rr in rule_results:
                        if float(rr.get("score", 0)) > 0.3:
                            matched = True
                            matched_by = "rule"
                            matched_item = rr.get("title", rr.get("id", ""))
                            break
                except Exception:
                    pass

            # 搜索经验（已解决的类似经验）
            if not matched:
                try:
                    exp_results = search_svc.search_single_type(
                        "experiences", search_query, limit=5
                    )
                    for er in exp_results:
                        if float(er.get("score", 0)) > 0.5 and er.get("id") != exp_id:
                            matched = True
                            matched_by = "similar_experience"
                            matched_item = er.get("title", er.get("id", ""))
                            break
                except Exception:
                    pass

            if matched:
                detail = {
                    "exp_id": exp_id,
                    "title": title,
                    "matched_by": matched_by,
                    "matched_item": matched_item,
                }
                already_covered_details.append(detail)

                # 3. 自动解决
                if auto_resolve and not dry_run:
                    try:
                        knowledge_svc.resolve_experience(exp_id)
                        resolved_count += 1
                        detail["resolved"] = True
                    except Exception:
                        detail["resolved"] = False
                        detail["resolve_error"] = "resolve_experience 调用失败"
                else:
                    detail["resolved"] = False

        mode_label = "试运行" if dry_run else "正式执行"
        return success_response(
            data={
                "total_unresolved": total_unresolved,
                "resolved_count": resolved_count,
                "already_covered_details": already_covered_details,
            },
            message=f"自动解决完成 ({mode_label}): 共 {total_unresolved} 条未解决, "
                    f"发现 {len(already_covered_details)} 条已覆盖, "
                    f"实际解决 {resolved_count} 条",
        )
    except Exception as e:
        return error_response(str(e))
