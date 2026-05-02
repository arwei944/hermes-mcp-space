# -*- coding: utf-8 -*-
"""截取网页截图并保存到本地（使用 Playwright 无头浏览器）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="capture_screenshot",
        description="截取网页截图并保存到本地（使用 Playwright 无头浏览器）",
        schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "要截图的网页 URL"},
                "width": {"type": "integer", "default": 1280, "description": "视口宽度（像素）"},
                "height": {"type": "integer", "default": 720, "description": "视口高度（像素）"},
                "full_page": {"type": "boolean", "default": False, "description": "是否截取完整页面（长截图）"},
            },
            "required": ["url"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """capture_screenshot handler"""
    url = args.get("url", "")
    width = int(args.get("width", 1280))
    height = int(args.get("height", 720))
    full_page = args.get("full_page", False)

    if not url:
        return error_response(
            "请提供要截图的网页 URL",
            code="INVALID_ARGS",
        )

    try:
        import uuid
        import os
        from playwright.sync_api import sync_playwright

        filename = f"screenshot_{uuid.uuid4().hex[:8]}.png"
        # 保存到 hermes home 的 screenshots 目录
        from backend.config import get_hermes_home
        hermes_home = get_hermes_home()
        screenshot_dir = hermes_home / "screenshots"
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        filepath = screenshot_dir / filename

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(url, wait_until="networkidle", timeout=30000)
            page.screenshot(path=str(filepath), full_page=full_page)
            browser.close()

        result = f"截图已保存: {filepath}\nURL: {url}\n尺寸: {width}x{height}\n完整页面: {'是' if full_page else '否'}"
        return success_response(result)
    except ImportError:
        return error_response(
            "Playwright 未安装，请运行: pip install playwright && playwright install chromium",
            code="MISSING_DEP",
        )
    except Exception as e:
        return error_response(
            f"截图失败: {e}\n建议：\n1. 检查 URL 是否正确且可访问\n2. 确认 Playwright 和 Chromium 已正确安装\n3. 检查网络连接是否正常",
            code="SCREENSHOT_ERROR",
        )
