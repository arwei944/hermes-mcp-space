# -*- coding: utf-8 -*-
"""代理网页抓取 - 供 SOLO 等外部 Agent 通过 MCP 调用，绕过沙箱网络限制"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="proxy_fetch",
        description="代理抓取网页内容并返回纯文本。当沙箱环境无法直接访问某个网站时，通过此工具在服务端抓取网页并返回内容。支持自定义请求头和超时设置。",
        schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "要抓取的网页 URL"},
                "max_length": {"type": "integer", "default": 8000, "description": "最大返回字符数，默认 8000"},
                "timeout": {"type": "integer", "default": 20, "description": "请求超时秒数，默认 20"},
                "headers": {"type": "string", "default": "", "description": "自定义请求头，JSON 格式，如 '{\"Cookie\": \"...\"}'"},
                "raw": {"type": "boolean", "default": False, "description": "是否返回原始 HTML（不清洗标签），默认 false"},
            },
            "required": ["url"]
        },
        handler=handle,
        tags=["system", "proxy"],
    )


def handle(args: dict) -> dict:
    url = args.get("url", "")
    max_length = int(args.get("max_length", 8000))
    timeout = int(args.get("timeout", 20))
    headers_str = args.get("headers", "")
    raw = args.get("raw", False)

    if not url:
        return error_response("请提供 URL", code="INVALID_ARGS")

    try:
        import urllib.request as _ur
        import re as _re
        import json as _json

        default_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }

        # 合并自定义请求头
        if headers_str:
            try:
                custom = _json.loads(headers_str)
                default_headers.update(custom)
            except _json.JSONDecodeError:
                return error_response("headers 参数必须是合法的 JSON 字符串", code="INVALID_ARGS")

        req = _ur.Request(url, headers=default_headers)

        with _ur.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type", "")
            charset = "utf-8"
            # 从 Content-Type 提取编码
            ct_match = _re.search(r'charset=([a-zA-Z0-9_-]+)', content_type, _re.IGNORECASE)
            if ct_match:
                charset = ct_match.group(1)
            html = resp.read().decode(charset, errors="replace")

        if raw:
            text = html
        else:
            # 移除 script/style
            html = _re.sub(r'<script[^>]*>.*?</script>', '', html, flags=_re.DOTALL | _re.IGNORECASE)
            html = _re.sub(r'<style[^>]*>.*?</style>', '', html, flags=_re.DOTALL | _re.IGNORECASE)
            html = _re.sub(r'<!--.*?-->', '', html, flags=_re.DOTALL)
            # 移除 HTML 标签
            text = _re.sub(r'<[^>]+>', ' ', html)
            # 清理空白
            text = _re.sub(r'\s+', ' ', text).strip()

        if len(text) > max_length:
            text = text[:max_length] + f"\n... (内容已截断，共 {len(text)} 字符)"

        result = f"URL: {url}\nContent-Type: {content_type}\n长度: {len(text)} 字符\n{'='*50}\n{text}"
        return success_response(result)

    except Exception as e:
        return error_response(
            f"代理抓取失败: {e}",
            code="PROXY_FETCH_ERROR",
        )
