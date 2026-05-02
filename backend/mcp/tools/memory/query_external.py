# -*- coding: utf-8 -*-
"""查询外部记忆（语义搜索历史记忆）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="query_memory",
        description="查询外部记忆（语义搜索历史记忆）",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索查询"},
                "limit": {"type": "integer", "default": 5, "description": "返回条数"}
            },
            "required": ["query"]
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """查询外部记忆"""
    query = args.get("query", "")
    if not query:
        return error_response("请提供搜索查询。")
    limit = int(args.get("limit", 5))
    try:
        from backend.config import get_hermes_home
        memory_file = get_hermes_home() / "external_memory.md"
        if not memory_file.exists():
            return success_response(data=None, message="暂无外部记忆。使用 store_memory 存储记忆。")

        text = memory_file.read_text(encoding="utf-8")
        entries = text.split("## [")
        # 简单关键词匹配
        query_lower = query.lower()
        matched = []
        for entry in entries:
            if query_lower in entry.lower():
                matched.append("## [" + entry)
                if len(matched) >= limit:
                    break

        if not matched:
            return success_response(data={"matched": 0, "entries": []},
                                   message=f"未找到匹配 '{query}' 的记忆。")

        return success_response(data={"matched": len(matched), "entries": matched})
    except Exception as e:
        return error_response(str(e))
