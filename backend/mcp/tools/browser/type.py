# -*- coding: utf-8 -*-
"""在页面输入框中输入文本"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="browser_type",
        description="在页面输入框中输入文本",
        schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS 选择器"},
                "text": {"type": "string", "description": "要输入的文本"}
            },
            "required": ["selector", "text"],
        },
        handler=handle,
        tags=["browser"],
    )


def handle(args: dict) -> dict:
    """在页面输入框中输入文本"""
    selector = args.get("selector", "")
    text = args.get("text", "")
    if not selector or not text:
        return error_response("请提供选择器和输入文本。")
    return success_response(
        message="browser_type 需要浏览器环境。\n在当前环境中不可用。"
    )
