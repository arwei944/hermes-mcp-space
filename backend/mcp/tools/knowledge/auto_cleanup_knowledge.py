# -*- coding: utf-8 -*-
"""自动清理知识库：检测重复、过时、低置信度条目"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def _string_similarity(a: str, b: str) -> float:
    """简单的字符串相似度计算（基于公共字符序列）"""
    if not a or not b:
        return 0.0
    a, b = a.lower().strip(), b.lower().strip()
    if a == b:
        return 1.0
    # 使用集合交并比作为简单相似度
    set_a = set(a)
    set_b = set(b)
    intersection = set_a & set_b
    union = set_a | set_b
    if not union:
        return 0.0
    return len(intersection) / len(union)


def register(reg):
    register_tool(
        reg,
        name="auto_cleanup_knowledge",
        description="自动清理知识库：检测并处理重复条目、过时条目和低置信度条目。支持检测、合并重复、移除过时和全面清理四种模式。",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["detect", "merge_duplicates", "remove_outdated", "full_cleanup"],
                    "default": "detect",
                    "description": "清理操作: detect 仅检测 / merge_duplicates 合并重复 / remove_outdated 移除过时 / full_cleanup 全面清理",
                },
                "confidence_threshold": {
                    "type": "number",
                    "default": 0.3,
                    "description": "低置信度阈值，置信度低于此值的条目将被标记",
                },
                "days_inactive": {
                    "type": "integer",
                    "default": 90,
                    "description": "不活跃天数阈值，超过此天数未被查看的条目视为过时",
                },
            },
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService
    from datetime import datetime, timedelta

    try:
        knowledge_svc = KnowledgeService()

        action = args.get("action", "detect")
        confidence_threshold = float(args.get("confidence_threshold", 0.3))
        days_inactive = int(args.get("days_inactive", 90))

        if confidence_threshold < 0 or confidence_threshold > 1:
            return error_response("confidence_threshold 必须在 0 到 1 之间")
        if days_inactive < 1:
            return error_response("days_inactive 必须大于 0")

        # 1. 获取所有活跃的知识条目
        all_knowledge = knowledge_svc.list_knowledge(is_active=True)
        cutoff_date = datetime.now() - timedelta(days=days_inactive)

        # 2. 分析各类问题
        # 低置信度条目
        low_confidence = []
        for kn in all_knowledge:
            conf = float(kn.get("confidence", 1.0))
            if conf < confidence_threshold:
                low_confidence.append({
                    "id": kn.get("id"),
                    "title": kn.get("title", ""),
                    "confidence": conf,
                    "category": kn.get("category", ""),
                })

        # 过时条目（view_count=0 且 updated_at 早于 cutoff）
        outdated = []
        for kn in all_knowledge:
            view_count = int(kn.get("view_count", 0))
            updated_at_str = kn.get("updated_at") or kn.get("created_at", "")

            if view_count == 0 and updated_at_str:
                try:
                    # 处理多种日期格式
                    if isinstance(updated_at_str, datetime):
                        updated_at = updated_at_str
                    else:
                        updated_at = datetime.fromisoformat(str(updated_at_str).replace("Z", "+00:00").replace("+00:00", ""))

                    if updated_at < cutoff_date:
                        outdated.append({
                            "id": kn.get("id"),
                            "title": kn.get("title", ""),
                            "updated_at": updated_at_str,
                            "category": kn.get("category", ""),
                        })
                except (ValueError, TypeError):
                    pass

        # 重复检测（同类别 + 标题相似度 > 0.8）
        duplicate_groups = []
        checked = set()
        for i, kn_a in enumerate(all_knowledge):
            if kn_a.get("id") in checked:
                continue
            cat_a = kn_a.get("category", "")
            title_a = kn_a.get("title", "")

            group = [kn_a.get("id")]
            for j, kn_b in enumerate(all_knowledge):
                if i == j or kn_b.get("id") in checked:
                    continue
                cat_b = kn_b.get("category", "")
                title_b = kn_b.get("title", "")

                if cat_a == cat_b and _string_similarity(title_a, title_b) > 0.8:
                    group.append(kn_b.get("id"))
                    checked.add(kn_b.get("id"))

            if len(group) > 1:
                checked.add(kn_a.get("id"))
                duplicate_groups.append({
                    "knowledge_ids": group,
                    "category": cat_a,
                    "representative_title": title_a,
                    "count": len(group),
                })

        actions_taken = []

        # 3. 根据操作类型执行
        if action == "detect":
            # 仅检测，不做修改
            pass

        elif action == "merge_duplicates":
            for dup_group in duplicate_groups:
                # 保留置信度最高的条目
                best_id = None
                best_conf = -1
                for kn_id in dup_group["knowledge_ids"]:
                    kn = knowledge_svc.get_knowledge(kn_id)
                    if kn:
                        conf = float(kn.get("confidence", 0))
                        if conf > best_conf:
                            best_conf = conf
                            best_id = kn_id

                # 标记其他条目为非活跃
                deactivated = []
                for kn_id in dup_group["knowledge_ids"]:
                    if kn_id != best_id:
                        try:
                            knowledge_svc.update_knowledge(kn_id, is_active=False)
                            deactivated.append(kn_id)
                        except Exception:
                            pass

                actions_taken.append({
                    "action": "merge",
                    "group": dup_group["knowledge_ids"],
                    "kept_id": best_id,
                    "deactivated_ids": deactivated,
                })

        elif action == "remove_outdated":
            for kn in outdated:
                try:
                    knowledge_svc.update_knowledge(kn["id"], is_active=False)
                    actions_taken.append({
                        "action": "deactivate_outdated",
                        "id": kn["id"],
                        "title": kn["title"],
                    })
                except Exception:
                    pass

        elif action == "full_cleanup":
            # 合并重复
            for dup_group in duplicate_groups:
                best_id = None
                best_conf = -1
                for kn_id in dup_group["knowledge_ids"]:
                    kn = knowledge_svc.get_knowledge(kn_id)
                    if kn:
                        conf = float(kn.get("confidence", 0))
                        if conf > best_conf:
                            best_conf = conf
                            best_id = kn_id

                deactivated = []
                for kn_id in dup_group["knowledge_ids"]:
                    if kn_id != best_id:
                        try:
                            knowledge_svc.update_knowledge(kn_id, is_active=False)
                            deactivated.append(kn_id)
                        except Exception:
                            pass

                actions_taken.append({
                    "action": "merge",
                    "group": dup_group["knowledge_ids"],
                    "kept_id": best_id,
                    "deactivated_ids": deactivated,
                })

            # 移除过时
            for kn in outdated:
                try:
                    knowledge_svc.update_knowledge(kn["id"], is_active=False)
                    actions_taken.append({
                        "action": "deactivate_outdated",
                        "id": kn["id"],
                        "title": kn["title"],
                    })
                except Exception:
                    pass

            # 标记低置信度（仅记录，不自动删除）
            for kn in low_confidence:
                actions_taken.append({
                    "action": "flag_low_confidence",
                    "id": kn["id"],
                    "title": kn["title"],
                    "confidence": kn["confidence"],
                })

        else:
            return error_response(f"无效的 action: {action}")

        return success_response(
            data={
                "action": action,
                "low_confidence_count": len(low_confidence),
                "outdated_count": len(outdated),
                "duplicate_groups": duplicate_groups,
                "low_confidence_details": low_confidence,
                "outdated_details": outdated,
                "actions_taken": actions_taken,
            },
            message=f"知识库清理完成 ({action}): "
                    f"低置信度 {len(low_confidence)} 条, "
                    f"过时 {len(outdated)} 条, "
                    f"重复组 {len(duplicate_groups)} 组, "
                    f"执行操作 {len(actions_taken)} 项",
        )
    except Exception as e:
        return error_response(str(e))
