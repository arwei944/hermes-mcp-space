# -*- coding: utf-8 -*-
"""写入 Agent 人格定义（SOUL.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="write_soul",
        description="写入 Agent 人格定义（SOUL.md）",
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "人格定义内容（Markdown 格式）"}
            },
            "required": ["content"]
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """写入 Agent 人格定义"""
    content = args.get("content", "")
    if not content:
        return error_response("请提供人格定义内容")
    try:
        from backend.config import get_hermes_home
        soul_path = get_hermes_home() / "SOUL.md"
        soul_path.parent.mkdir(parents=True, exist_ok=True)
        soul_path.write_text(content, encoding="utf-8")
        return success_response(message=f"SOUL.md 已更新 ({len(content)} 字符)")
    except Exception as e:
        return error_response(str(e))
