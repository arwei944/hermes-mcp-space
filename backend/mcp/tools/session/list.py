# -*- coding: utf-8 -*-
"""列出最近的会话列表"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_sessions",
        description="列出最近的会话列表",
        schema={
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 20, "description": "返回的最大会话数"}
            }
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """列出最近的会话列表"""
    from backend.services.hermes_service import hermes_service

    try:
        sessions = hermes_service.list_sessions()
        limit = args.get("limit", 20)
        result = sessions[:limit]
        if not result:
            return success_response(message="当前没有会话记录")
        lines = []
        for s in result:
            lines.append(
                f"- [{s.get('id', '?')}] {s.get('title', s.get('source', '?'))} | "
                f"{s.get('model', '?')} | {s.get('created_at', '?')}"
            )
        return success_response(
            data={"sessions": result, "total": len(sessions)},
            message=f"共 {len(sessions)} 个会话:\n" + "\n".join(lines),
        )
    except Exception as e:
        return error_response(str(e))
