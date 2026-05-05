# -*- coding: utf-8 -*-
"""代理网页搜索 - 供 SOLO 等外部 Agent 通过 MCP 调用，绕过沙箱网络限制"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="proxy_search",
        description="代理搜索网页内容（使用 DuckDuckGo）。当沙箱环境无法直接搜索时，通过此工具在服务端执行搜索并返回结果。",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "max_results": {"type": "integer", "default": 8, "description": "最大结果数，默认 8"},
                "region": {"type": "string", "default": "wt-wt", "description": "搜索区域，如 wt-wt(全球), cn-zh(中国), jp-jp(日本)"},
            },
            "required": ["query"]
        },
        handler=handle,
        tags=["system", "proxy"],
    )


def _fallback_search(query: str, max_results: int) -> str:
    """降级搜索：DuckDuckGo HTML"""
    import urllib.parse as _up
    import urllib.request as _ur
    import ssl as _ssl
    import re as _re

    url = f"https://html.duckduckgo.com/html/?q={_up.quote(query)}"
    req = _ur.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    ctx = _ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    with _ur.urlopen(req, timeout=15, context=ctx) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    results = _re.findall(
        r'class="result__a"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</a>',
        html, _re.DOTALL,
    )
    if not results:
        return f"未找到 '{query}' 的搜索结果"

    output = []
    for i, (title, snippet) in enumerate(results[:max_results]):
        clean_title = _re.sub(r'<[^>]+>', '', title).strip()
        clean_snippet = _re.sub(r'<[^>]+>', '', snippet).strip()
        output.append(f"{i+1}. {clean_title}\n   {clean_snippet}")
    return "\n\n".join(output)


def handle(args: dict) -> dict:
    query = args.get("query", "")
    max_results = int(args.get("max_results", 8))
    region = args.get("region", "wt-wt")

    if not query:
        return error_response("请提供搜索关键词", code="INVALID_ARGS")

    try:
        from duckduckgo_search import DDGS

        results = []
        with DDGS(region=region) as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(
                    f"标题: {r.get('title', '')}\n链接: {r.get('href', '')}\n摘要: {r.get('body', '')}"
                )
        if not results:
            return success_response(f"未找到 '{query}' 的搜索结果")
        result = f"搜索: {query}\n{'='*50}\n\n" + "\n\n---\n\n".join(results)
        return success_response(result)

    except ImportError:
        try:
            text = _fallback_search(query, max_results)
            result = f"搜索: {query}\n{'='*50}\n\n{text}"
            return success_response(result)
        except Exception as e:
            return error_response(f"代理搜索失败: {e}", code="PROXY_SEARCH_ERROR")

    except Exception as e:
        try:
            text = _fallback_search(query, max_results)
            result = f"搜索: {query}\n{'='*50}\n\n{text}"
            return success_response(result)
        except Exception as e2:
            return error_response(f"代理搜索失败: {e2}", code="PROXY_SEARCH_ERROR")
