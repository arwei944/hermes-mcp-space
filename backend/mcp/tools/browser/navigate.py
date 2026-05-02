# -*- coding: utf-8 -*-
"""打开网页 URL"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="browser_navigate",
        description="打开网页 URL",
        schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "网页 URL"}
            },
            "required": ["url"],
        },
        handler=handle,
        tags=["browser"],
    )


def handle(args: dict) -> dict:
    """打开网页 URL，提取页面文本摘要"""
    url = args.get("url", "")
    if not url:
        return error_response("请提供 URL。\n建议：\n1. 确保包含协议前缀（https://）\n2. 检查 URL 拼写")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        import urllib.request
        import re

        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        # 提取页面文本摘要
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.DOTALL)
        title = title_match.group(1).strip() if title_match else "无标题"
        result = f"页面: {title}\nURL: {url}\n长度: {len(html)} 字符\n\n内容摘要:\n{text[:2000]}"
        return success_response(data={"title": title, "url": url, "html_length": len(html), "summary": text[:2000]}, message=result)
    except Exception as e:
        return error_response(f"无法访问 {url}: {e}\n建议：\n1. 检查 URL 是否正确\n2. 确认网站可访问\n3. 尝试使用 web_fetch 作为替代")
