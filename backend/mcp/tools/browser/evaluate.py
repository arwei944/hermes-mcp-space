# -*- coding: utf-8 -*-
"""在页面中执行 JavaScript 代码"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="browser_evaluate",
        description="在页面中执行 JavaScript 代码",
        schema={
            "type": "object",
            "properties": {
                "script": {"type": "string", "description": "JavaScript 代码"}
            },
            "required": ["script"],
        },
        handler=handle,
        tags=["browser"],
    )


def handle(args: dict) -> dict:
    """在页面中执行 JavaScript 代码"""
    script = args.get("script", "")
    if not script:
        return error_response("请提供 JavaScript 代码。")
    return success_response(
        message="browser_evaluate 需要浏览器环境。\n在当前环境中不可用。"
    )
