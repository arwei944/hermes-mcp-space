# -*- coding: utf-8 -*-
"""搜索经验（全文检索）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="experience_search",
        description="搜索经验（全文检索）",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "limit": {"type": "integer", "default": 20, "description": "返回数量上限"},
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
        results = search_svc.search_single_type(
            "experiences", args["query"], limit=args.get("limit", 20)
        )
        return success_response(
            data=results,
            message=f"找到 {len(results)} 条经验",
        )
    except Exception as e:
        return error_response(str(e))
