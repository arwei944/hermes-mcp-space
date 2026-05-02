# -*- coding: utf-8 -*-
"""抓取网页内容并返回纯文本"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="web_fetch",
        description="抓取网页内容并返回纯文本",
        schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "网页 URL"},
                "max_length": {"type": "integer", "default": 5000, "description": "最大返回字符数"}
            },
            "required": ["url"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """web_fetch handler"""
    url = args.get("url", "")
    max_length = int(args.get("max_length", 5000))

    if not url:
        return error_response(
            "请提供 URL",
            code="INVALID_ARGS",
        )

    try:
        import urllib.request as _ur
        import re as _re

        req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with _ur.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        # 移除 script/style 标签
        html = _re.sub(r'<script[^>]*>.*?</script>', '', html, flags=_re.DOTALL | _re.IGNORECASE)
        html = _re.sub(r'<style[^>]*>.*?</style>', '', html, flags=_re.DOTALL | _re.IGNORECASE)
        # 移除 HTML 标签
        text = _re.sub(r'<[^>]+>', ' ', html)
        # 清理空白
        text = _re.sub(r'\s+', ' ', text).strip()
        if len(text) > max_length:
            text = text[:max_length] + f"\n... (内容已截断，共 {len(text)} 字符)"
        result = f"URL: {url}\n长度: {len(text)} 字符\n{'='*50}\n{text}"
        return success_response(result)
    except Exception as e:
        return error_response(
            f"抓取网页失败: {e}\n建议：\n1. 检查 URL 是否正确且可访问（在浏览器中打开确认）\n2. 某些网站可能拒绝非浏览器请求，尝试其他网站\n3. 检查网络连接是否正常，确认目标服务器未宕机",
            code="FETCH_ERROR",
        )
