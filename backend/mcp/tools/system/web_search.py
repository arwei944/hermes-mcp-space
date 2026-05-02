# -*- coding: utf-8 -*-
"""搜索网页内容（使用 DuckDuckGo）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="web_search",
        description="搜索网页内容（使用 DuckDuckGo）",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "max_results": {"type": "integer", "default": 5, "description": "最大结果数"}
            },
            "required": ["query"]
        },
        handler=handle,
        tags=["system"],
    )


def _fallback_search(query: str, max_results: int) -> str:
    """降级搜索：使用 requests + DuckDuckGo HTML"""
    import urllib.parse as _up
    import urllib.request as _ur
    import ssl as _ssl
    import re as _re

    url = f"https://html.duckduckgo.com/html/?q={_up.quote(query)}"
    req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = _ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    with _ur.urlopen(req, timeout=10, context=ctx) as resp:
        html = resp.read().decode("utf-8", errors="replace")
    # 提取搜索结果
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
    return f"搜索: {query}\n{'='*50}\n\n" + "\n\n".join(output)


def handle(args: dict) -> dict:
    """web_search handler"""
    query = args.get("query", "")
    max_results = int(args.get("max_results", 5))

    if not query:
        return error_response(
            "请提供搜索关键词",
            code="INVALID_ARGS",
        )

    try:
        from duckduckgo_search import DDGS

        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(
                    f"标题: {r.get('title', '')}\n链接: {r.get('href', '')}\n摘要: {r.get('body', '')}"
                )
        if not results:
            return success_response(f"未找到 '{query}' 的搜索结果")
        result = f"搜索: {query}\n{'='*50}\n\n" + "\n\n---\n\n".join(results)
        return success_response(result)
    except ImportError:
        # 降级：使用 requests + DuckDuckGo HTML
        try:
            result = _fallback_search(query, max_results)
            return success_response(result)
        except Exception as e:
            return error_response(
                f"搜索失败: {e}\n建议：\n1. 尝试使用英文关键词重新搜索，可能获得更多结果\n2. 简化关键词，避免过于复杂的查询\n3. 如果持续失败，可能是网络连接问题，请检查网络状态",
                code="SEARCH_ERROR",
            )
    except Exception as e:
        # DDGS 库存在但调用失败，尝试降级
        try:
            result = _fallback_search(query, max_results)
            return success_response(result)
        except Exception as e2:
            return error_response(
                f"搜索失败: {e2}\n建议：\n1. 尝试使用英文关键词重新搜索，可能获得更多结果\n2. 简化关键词，避免过于复杂的查询\n3. 如果持续失败，可能是网络连接问题，请检查网络状态",
                code="SEARCH_ERROR",
            )
