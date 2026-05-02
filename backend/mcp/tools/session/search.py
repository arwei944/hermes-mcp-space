# -*- coding: utf-8 -*-
"""搜索会话（按标题或模型名模糊匹配）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="search_sessions",
        description="搜索会话（按标题或模型名模糊匹配）",
        schema={
            "type": "object",
            "properties": {
                "keyword": {"type": "string", "description": "搜索关键词"},
                "limit": {"type": "integer", "default": 10, "description": "返回的最大数量"}
            },
            "required": ["keyword"]
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """搜索会话（按标题或模型名模糊匹配）"""
    from backend.services.hermes_service import hermes_service

    try:
        keyword = args["keyword"].lower()
        limit = args.get("limit", 10)
        sessions = hermes_service.list_sessions()
        matched = [
            s for s in sessions
            if keyword in str(s.get("title", "")).lower()
            or keyword in str(s.get("model", "")).lower()
            or keyword in str(s.get("id", "")).lower()
        ]
        result = matched[:limit]
        if not result:
            return success_response(
                data={"matched": [], "total": 0},
                message=f"没有找到包含 '{args['keyword']}' 的会话",
            )
        lines = []
        for s in result:
            lines.append(
                f"- [{s.get('id', '?')}] {s.get('title', '?')} | {s.get('model', '?')}"
            )
        return success_response(
            data={"sessions": result, "total": len(matched)},
            message=f"找到 {len(matched)} 个匹配会话:\n" + "\n".join(lines),
        )
    except Exception as e:
        return error_response(str(e))
