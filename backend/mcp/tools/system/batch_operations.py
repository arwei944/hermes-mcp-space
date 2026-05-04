# -*- coding: utf-8 -*-
"""批量操作工具 - 对 Hermes 数据进行批量创建、删除等 CRUD 操作"""

import json

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="batch_operations",
        description="对 Hermes 数据进行批量操作，支持批量创建记忆、批量删除记忆、批量创建知识条目",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["batch_create_memory", "batch_delete_memory", "batch_create_knowledge"],
                    "description": "批量操作类型",
                },
                "items": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": (
                        "操作项数组。batch_create_memory: [{content, title?, category?, tags?, importance?}]；"
                        "batch_delete_memory: [{mem_id, reason?}]；"
                        "batch_create_knowledge: [{title, content, summary?, category?, tags?, source?}]"
                    ),
                },
                "target_type": {
                    "type": "string",
                    "description": "目标类型（可选，用于扩展）",
                },
            },
            "required": ["action", "items"],
        },
        handler=handle,
        tags=["system"],
    )


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _batch_create_memory(items: list) -> dict:
    """批量创建记忆"""
    from backend.services.review_service import ReviewService

    review_svc = ReviewService()
    succeeded = []
    failed = []

    for idx, item in enumerate(items):
        try:
            if not isinstance(item, dict):
                raise ValueError("操作项必须是对象")

            content = item.get("content", "")
            if not content:
                raise ValueError("content 字段不能为空")

            tag_list = (
                [t.strip() for t in item.get("tags", "").split(",") if t.strip()]
                if item.get("tags")
                else []
            )
            payload = json.dumps(
                {
                    "content": content,
                    "category": item.get("category", "agent_memory"),
                    "title": item.get("title", ""),
                    "importance": item.get("importance", 5),
                    "tags": tag_list,
                },
                ensure_ascii=False,
            )
            review = review_svc.submit_review(
                target_type="memory",
                action="create",
                title=item.get("title", "") or content[:50],
                content=payload,
                reason=item.get("reason", "批量创建"),
            )
            succeeded.append({
                "index": idx,
                "review_id": review["id"],
                "title": item.get("title", "") or content[:50],
            })
        except Exception as e:
            failed.append({
                "index": idx,
                "error": str(e),
                "item": item,
            })

    return {
        "total": len(items),
        "succeeded": len(succeeded),
        "failed": len(failed),
        "succeeded_items": succeeded,
        "failed_items": failed,
    }


def _batch_delete_memory(items: list) -> dict:
    """批量删除记忆"""
    from backend.services.knowledge_service import KnowledgeService
    from backend.services.review_service import ReviewService

    knowledge_svc = KnowledgeService()
    review_svc = ReviewService()
    succeeded = []
    failed = []

    for idx, item in enumerate(items):
        try:
            if not isinstance(item, dict):
                raise ValueError("操作项必须是对象")

            mem_id = item.get("mem_id", "")
            if not mem_id:
                raise ValueError("mem_id 字段不能为空")

            mem = knowledge_svc.get_memory(mem_id)
            if not mem:
                raise ValueError(f"记忆 {mem_id} 不存在")

            review = review_svc.submit_review(
                target_type="memory",
                action="delete",
                title=f"删除记忆: {mem['title']}",
                content="",
                old_content=mem["content"],
                reason=item.get("reason", "批量删除"),
                target_id=mem_id,
            )
            succeeded.append({
                "index": idx,
                "review_id": review["id"],
                "mem_id": mem_id,
                "title": mem["title"],
            })
        except Exception as e:
            failed.append({
                "index": idx,
                "error": str(e),
                "item": item,
            })

    return {
        "total": len(items),
        "succeeded": len(succeeded),
        "failed": len(failed),
        "succeeded_items": succeeded,
        "failed_items": failed,
    }


def _batch_create_knowledge(items: list) -> dict:
    """批量创建知识条目"""
    from backend.services.review_service import ReviewService

    review_svc = ReviewService()
    succeeded = []
    failed = []

    for idx, item in enumerate(items):
        try:
            if not isinstance(item, dict):
                raise ValueError("操作项必须是对象")

            title = item.get("title", "")
            content = item.get("content", "")
            if not title or not content:
                raise ValueError("title 和 content 字段不能为空")

            tag_list = (
                [t.strip() for t in item.get("tags", "").split(",") if t.strip()]
                if item.get("tags")
                else []
            )
            payload = json.dumps(
                {
                    "title": title,
                    "content": content,
                    "summary": item.get("summary", ""),
                    "category": item.get("category", "general"),
                    "tags": tag_list,
                    "source": item.get("source", "ai_extracted"),
                    "source_ref": item.get("source_ref", ""),
                    "confidence": item.get("confidence", 0.8),
                },
                ensure_ascii=False,
            )
            review = review_svc.submit_review(
                target_type="knowledge",
                action="create",
                title=title,
                content=payload,
                reason=item.get("reason", "批量创建"),
                confidence=item.get("confidence", 0.8),
            )
            succeeded.append({
                "index": idx,
                "review_id": review["id"],
                "title": title,
            })
        except Exception as e:
            failed.append({
                "index": idx,
                "error": str(e),
                "item": item,
            })

    return {
        "total": len(items),
        "succeeded": len(succeeded),
        "failed": len(failed),
        "succeeded_items": succeeded,
        "failed_items": failed,
    }


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def handle(args: dict) -> dict:
    """batch_operations handler"""
    action = args.get("action", "")
    items = args.get("items", [])
    target_type = args.get("target_type", "")

    valid_actions = ["batch_create_memory", "batch_delete_memory", "batch_create_knowledge"]
    if action not in valid_actions:
        return error_response(f"不支持的操作类型: {action}，可选: {valid_actions}")

    if not items or not isinstance(items, list):
        return error_response("请提供有效的 items 数组")

    if len(items) > 100:
        return error_response("单次批量操作最多支持 100 条数据")

    try:
        action_handlers = {
            "batch_create_memory": _batch_create_memory,
            "batch_delete_memory": _batch_delete_memory,
            "batch_create_knowledge": _batch_create_knowledge,
        }

        result = action_handlers[action](items)

        summary_msg = (
            f"批量操作完成: 共 {result['total']} 条，"
            f"成功 {result['succeeded']} 条，"
            f"失败 {result['failed']} 条"
        )
        if result["failed"] > 0:
            summary_msg += f"\n失败原因: {[f['error'] for f in result['failed_items']]}"

        return success_response(data=result, message=summary_msg)

    except Exception as e:
        return error_response(str(e))
