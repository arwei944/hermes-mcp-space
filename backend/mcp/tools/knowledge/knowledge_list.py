# -*- coding: utf-8 -*-
"""列出知识条目"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="knowledge_list",
        description="列出知识条目",
        schema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "分类筛选"},
                "tags": {"type": "string", "description": "标签筛选（逗号分隔）"},
                "confidence_min": {"type": "number", "default": 0, "description": "最低置信度"},
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
        tag_list = (
            [t.strip() for t in args.get("tags", "").split(",") if t.strip()]
            if args.get("tags")
            else None
        )
        items = svc.list_knowledge(
            category=args.get("category") or None,
            tags=tag_list,
            confidence_min=args.get("confidence_min", 0) or None,
            limit=args.get("limit", 50),
        )
        return success_response(data={"items": items, "count": len(items)})
    except Exception as e:
        return error_response(str(e))
