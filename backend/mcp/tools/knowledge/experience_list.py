# -*- coding: utf-8 -*-
"""列出经验条目"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="experience_list",
        description="列出经验条目",
        schema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "分类筛选"},
                "severity": {"type": "string", "description": "严重程度筛选"},
                "is_resolved": {"type": "boolean", "description": "是否已解决"},
                "tool_name": {"type": "string", "description": "工具名称筛选"},
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
        items = svc.list_experiences(
            category=args.get("category") or None,
            severity=args.get("severity") or None,
            is_resolved=args.get("is_resolved"),
            tool_name=args.get("tool_name") or None,
            limit=args.get("limit", 50),
        )
        return success_response(data={"items": items, "count": len(items)})
    except Exception as e:
        return error_response(str(e))
