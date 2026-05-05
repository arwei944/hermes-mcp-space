# -*- coding: utf-8 -*-
"""代理 API 请求 - 供 SOLO 等外部 Agent 通过 MCP 调用，绕过沙箱网络限制访问任意 API"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="proxy_api",
        description="代理发送 HTTP 请求并返回响应。当沙箱环境无法直接访问某个 API 时，通过此工具在服务端发起请求。支持 GET/POST/PUT/DELETE 方法和自定义请求头/请求体。",
        schema={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "请求的 URL"},
                "method": {"type": "string", "default": "GET", "description": "HTTP 方法: GET, POST, PUT, DELETE, PATCH"},
                "headers": {"type": "string", "default": "", "description": "自定义请求头，JSON 格式，如 '{\"Authorization\": \"Bearer xxx\"}'"},
                "body": {"type": "string", "default": "", "description": "请求体（POST/PUT/PATCH 时使用），JSON 格式"},
                "timeout": {"type": "integer", "default": 20, "description": "请求超时秒数，默认 20"},
                "max_length": {"type": "integer", "default": 8000, "description": "最大返回字符数，默认 8000"},
            },
            "required": ["url"]
        },
        handler=handle,
        tags=["system", "proxy"],
    )


def handle(args: dict) -> dict:
    url = args.get("url", "")
    method = args.get("method", "GET").upper()
    headers_str = args.get("headers", "")
    body_str = args.get("body", "")
    timeout = int(args.get("timeout", 20))
    max_length = int(args.get("max_length", 8000))

    if not url:
        return error_response("请提供 URL", code="INVALID_ARGS")

    if method not in ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"):
        return error_response(f"不支持的 HTTP 方法: {method}", code="INVALID_ARGS")

    try:
        import urllib.request as _ur
        import json as _json

        default_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/html, */*",
        }

        if headers_str:
            try:
                custom = _json.loads(headers_str)
                default_headers.update(custom)
            except _json.JSONDecodeError:
                return error_response("headers 参数必须是合法的 JSON 字符串", code="INVALID_ARGS")

        data = None
        if body_str and method in ("POST", "PUT", "PATCH"):
            data = body_str.encode("utf-8")
            if "Content-Type" not in default_headers:
                default_headers["Content-Type"] = "application/json"

        req = _ur.Request(url, data=data, headers=default_headers, method=method)

        with _ur.urlopen(req, timeout=timeout) as resp:
            status_code = resp.status
            resp_headers = dict(resp.headers)
            resp_body = resp.read().decode("utf-8", errors="replace")

        # 尝试格式化 JSON 响应
        try:
            parsed = _json.loads(resp_body)
            resp_body = _json.dumps(parsed, indent=2, ensure_ascii=False)
        except (_json.JSONDecodeError, ValueError):
            pass

        if len(resp_body) > max_length:
            resp_body = resp_body[:max_length] + f"\n... (内容已截断，共 {len(resp_body)} 字符)"

        result = (
            f"URL: {url}\nMethod: {method}\nStatus: {status_code}\n"
            f"{'='*50}\n{resp_body}"
        )
        return success_response(result)

    except Exception as e:
        return error_response(f"代理请求失败: {e}", code="PROXY_API_ERROR")
