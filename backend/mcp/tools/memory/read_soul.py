# -*- coding: utf-8 -*-
"""读取 Agent 人格定义（SOUL.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="read_soul",
        description="读取 Agent 人格定义（SOUL.md）",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """读取 Agent 人格定义"""
    try:
        from backend.config import get_hermes_home
        soul_path = get_hermes_home() / "SOUL.md"
        if soul_path.exists():
            content = soul_path.read_text(encoding="utf-8")
            return success_response(data={"content": content, "length": len(content)})
        else:
            return success_response(data=None, message="SOUL.md 尚未创建。使用 write_soul 工具创建 Agent 人格定义。")
    except Exception as e:
        return error_response(str(e))
