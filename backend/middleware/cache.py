# -*- coding: utf-8 -*-
"""API 响应缓存中间件

提供简单的内存缓存机制，通过环境变量控制启用。
仅缓存 GET 请求和 API 路径。
"""

import hashlib
import logging
import os
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)


class CacheMiddleware(BaseHTTPMiddleware):
    """简单的内存缓存中间件

    通过环境变量配置：
    - CACHE_ENABLED: 是否启用 (true/false, 默认 false)
    - CACHE_TTL: 缓存过期时间秒数 (默认 60)
    """

    def __init__(self, app):
        super().__init__(app)
        self._enabled = os.environ.get("CACHE_ENABLED", "false").lower() == "true"
        self._ttl = int(os.environ.get("CACHE_TTL", "60"))
        self._cache = {}

    def _get_cache_key(self, method: str, path: str, query: str) -> str:
        return hashlib.md5(f"{method}:{path}:{query}".encode()).hexdigest()

    async def dispatch(self, request, call_next):
        if not self._enabled:
            return await call_next(request)

        # 只缓存 GET 请求
        if request.method != "GET":
            return await call_next(request)

        # 只缓存 API 请求
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        cache_key = self._get_cache_key(
            request.method,
            path,
            str(request.query_params),
        )

        # 检查缓存
        cached = self._cache.get(cache_key)
        if cached and cached["expires"] > time.time():
            return Response(
                content=cached["body"],
                status_code=cached["status"],
                headers=dict(cached["headers"]),
            )

        # 请求并缓存
        response = await call_next(request)

        if response.status_code == 200:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk

            self._cache[cache_key] = {
                "body": body,
                "status": response.status_code,
                "headers": dict(response.headers),
                "expires": time.time() + self._ttl,
            }

            return Response(content=body, status_code=200, headers=dict(response.headers))

        return response
