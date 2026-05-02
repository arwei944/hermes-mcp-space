# -*- coding: utf-8 -*-
"""创建一个新的会话"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="create_session",
        description="创建一个新的会话",
        schema={
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "会话标题"},
                "model": {"type": "string", "description": "使用的模型名称"},
                "source": {"type": "string", "default": "mcp", "description": "来源（mcp/api/web）"}
            }
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """创建一个新的会话"""
    from backend.services.hermes_service import hermes_service

    try:
        result = hermes_service.create_session(
            title=args.get("title", ""),
            model=args.get("model", ""),
            source=args.get("source", "mcp"),
        )
        session = result.get("session", {})
        session_id = session.get("id", "")
        return success_response(
            data={"session": session},
            message=f"会话创建成功\nID: {session_id}\n标题: {session.get('title', '')}\n来源: {session.get('source', '')}",
        )
    except Exception as e:
        return error_response(str(e))
