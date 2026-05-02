# -*- coding: utf-8 -*-
"""点击页面元素（通过 CSS 选择器）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="browser_click",
        description="点击页面元素（通过 CSS 选择器）",
        schema={
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS 选择器（如 '#submit-btn' 或 'a[href=\"/login\"]'）"}
            },
            "required": ["selector"],
        },
        handler=handle,
        tags=["browser"],
    )


def handle(args: dict) -> dict:
    """点击页面元素"""
    selector = args.get("selector", "")
    if not selector:
        return error_response(
            "请提供 CSS 选择器。\n建议：\n1. 使用 browser_snapshot 获取页面结构\n2. 使用精确的选择器（如 #id 或 .class）"
        )
    return success_response(
        message=f"browser_click 需要浏览器环境。\n选择器: {selector}\n在当前环境中不可用。"
    )
