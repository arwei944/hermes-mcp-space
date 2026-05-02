# -*- coding: utf-8 -*-
"""全文搜索所有会话消息内容（SQLite FTS5）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="search_messages",
        description="全文搜索所有会话消息内容（SQLite FTS5）",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "session_id": {"type": "string", "description": "限定会话 ID（可选）"},
                "limit": {"type": "integer", "default": 20, "description": "最大结果数"}
            },
            "required": ["query"]
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """全文搜索所有会话消息内容（SQLite FTS5）"""
    from backend.services.hermes_service import hermes_service

    try:
        query = args.get("query", "")
        session_id = args.get("session_id")
        limit = int(args.get("limit", 20))
        if not query:
            return error_response(
                message="请提供搜索关键词",
                code="INVALID_ARGS",
            )

        results = hermes_service.search_messages(query, session_id, limit)
        if not results:
            return success_response(
                data={"results": [], "total": 0},
                message=f"未找到匹配 '{query}' 的消息",
            )
        output = [f"搜索: {query} | 找到 {len(results)} 条结果\n{'='*50}"]
        for r in results:
            content_preview = r["content"][:150].replace("\n", " ")
            output.append(f"[{r['role']}] ({r['session_id'][:12]}...) {content_preview}")
        return success_response(
            data={"results": results, "total": len(results)},
            message="\n".join(output),
        )
    except Exception as e:
        return error_response(str(e))
