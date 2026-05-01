# -*- coding: utf-8 -*-
"""API 认证中间件 - 支持 API Key 和 JWT"""
import os
import hmac
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """可选的 API 认证中间件

    通过环境变量 AUTH_TOKEN 设置认证 token。
    如果 AUTH_TOKEN 未设置，则跳过认证（开发模式）。

    认证方式：
    1. Header: Authorization: Bearer <token>
    2. Query: ?token=<token>
    3. Cookie: token=<token>
    """

    # 不需要认证的路径
    SKIP_PATHS = {
        "/", "/api/health", "/api/version", "/api/meta",
        "/docs", "/redoc", "/openapi.json",
        "/mcp", "/sse",  # MCP 端点使用自己的认证
    }

    async def dispatch(self, request, call_next):
        auth_token = os.environ.get("AUTH_TOKEN", "")

        # 如果未配置 AUTH_TOKEN，跳过认证
        if not auth_token:
            return await call_next(request)

        path = request.url.path

        # 跳过白名单路径
        if path in self.SKIP_PATHS or path.startswith("/static"):
            return await call_next(request)

        # 跳过 OPTIONS 预检请求
        if request.method == "OPTIONS":
            return await call_next(request)

        # 从多个来源提取 token
        token = None

        # 1. Authorization header
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

        # 2. Query parameter
        if not token:
            token = request.query_params.get("token")

        # 3. Cookie
        if not token:
            token = request.cookies.get("token")

        # 验证 token（使用 hmac.compare_digest 防止时序攻击）
        if not token or not hmac.compare_digest(token, auth_token):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required", "error": "unauthorized"},
            )

        return await call_next(request)
