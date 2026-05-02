# -*- coding: utf-8 -*-
"""列出记忆条目"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="memory_list",
        description="列出记忆条目",
        schema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "分类筛选"},
                "importance_min": {"type": "integer", "default": 0, "description": "最低重要度"},
                "limit": {"type": "integer", "default": 50, "description": "返回数量上限"},
            },
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService

    try:
        svc = KnowledgeService()
        items = svc.list_memories(
            category=args.get("category") or None,
            importance_min=args.get("importance_min", 0) or None,
            limit=args.get("limit", 50),
        )
        return success_response(
            data=items,
            message=f"共 {len(items)} 条记忆",
        )
    except Exception as e:
        return error_response(str(e))
