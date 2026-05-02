# -*- coding: utf-8 -*-
"""对当前页面截图（返回 base64 PNG）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="browser_screenshot",
        description="对当前页面截图（返回 base64 PNG）",
        schema={
            "type": "object",
            "properties": {
                "full_page": {"type": "boolean", "default": False, "description": "是否截取完整页面"}
            },
        },
        handler=handle,
        tags=["browser"],
    )


def handle(args: dict) -> dict:
    """对当前页面截图"""
    return success_response(
        message="browser_screenshot 需要浏览器环境（Playwright/Puppeteer）。\n在 HF Space 沙箱中不可用。建议使用 web_fetch 获取页面内容作为替代。"
    )
