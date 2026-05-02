# -*- coding: utf-8 -*-
"""跨类统一搜索（规则/知识/经验/记忆）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="unified_search",
        description="跨类统一搜索（规则/知识/经验/记忆）",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "types": {"type": "string", "description": "搜索类型（逗号分隔，如 rules,knowledge,experiences,memories）"},
                "limit": {"type": "integer", "default": 30, "description": "返回数量上限"},
            },
            "required": ["query"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.search_service import SearchService

    try:
        search_svc = SearchService()
        type_list = (
            [t.strip() for t in args.get("types", "").split(",") if t.strip()]
            if args.get("types")
            else None
        )
        results = search_svc.search_unified(
            args["query"], types=type_list, limit=args.get("limit", 30)
        )
        return success_response(
            data=results,
            message=f"统一搜索找到 {len(results)} 条结果",
        )
    except Exception as e:
        return error_response(str(e))
