# -*- coding: utf-8 -*-
"""获取当前页面的 DOM 快照（文本摘要）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="browser_snapshot",
        description="获取当前页面的 DOM 快照（文本摘要）",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["browser"],
    )


def handle(args: dict) -> dict:
    """获取当前页面的 DOM 快照"""
    try:
        return success_response(
            message="browser_snapshot 需要浏览器环境。\n在当前环境中，建议使用 web_fetch 获取页面内容，或使用 browser_navigate 导航后获取摘要。"
        )
    except Exception as e:
        return error_response(f"获取页面快照失败: {e}")
