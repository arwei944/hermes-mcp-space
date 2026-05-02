# -*- coding: utf-8 -*-
"""列出知识库规则"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="rule_list",
        description="列出知识库规则",
        schema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "分类筛选"},
                "tags": {"type": "string", "description": "标签筛选（逗号分隔）"},
                "priority_min": {"type": "integer", "default": 0, "description": "最低优先级"},
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
        rules = svc.list_rules(
            category=args.get("category") or None,
            tags=tag_list,
            priority_min=args.get("priority_min", 0) or None,
            limit=args.get("limit", 50),
        )
        return success_response(data={"items": rules, "count": len(rules)})
    except Exception as e:
        return error_response(str(e))
