# -*- coding: utf-8 -*-
"""API 速率限制中间件"""
import os
import time
import threading
from collections import defaultdict
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """简单的内存速率限制

    通过环境变量配置：
    - RATE_LIMIT_ENABLED: 是否启用 (true/false, 默认 false)
    - RATE_LIMIT_PER_MINUTE: 每分钟请求数 (默认 60)
    - RATE_LIMIT_PER_HOUR: 每小时请求数 (默认 1000)
    """

    def __init__(self, app):
        super().__init__(app)
        self._enabled = os.environ.get("RATE_LIMIT_ENABLED", "false").lower() == "true"
        self._per_minute = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "60"))
        self._per_hour = int(os.environ.get("RATE_LIMIT_PER_HOUR", "1000"))
        self._requests = defaultdict(list)
        self._lock = threading.Lock()

    def _check_rate(self, client_id: str) -> bool:
        """检查是否超过速率限制"""
        now = time.time()
        minute_ago = now - 60
        hour_ago = now - 3600

        with self._lock:
            # 清理旧记录
            self._requests[client_id] = [
                t for t in self._requests[client_id] if t > hour_ago
            ]

            requests = self._requests[client_id]

            # 检查每分钟限制
            recent_minute = sum(1 for t in requests if t > minute_ago)
            if recent_minute >= self._per_minute:
                return False

            # 检查每小时限制
            if len(requests) >= self._per_hour:
                return False

            requests.append(now)
            return True

    async def dispatch(self, request, call_next):
        if not self._enabled:
            return await call_next(request)

        # 使用 IP 或 Forwarded-For 作为客户端标识
        client_id = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_id = forwarded.split(",")[0].strip()

        if not self._check_rate(client_id):
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded", "error": "too_many_requests"},
            )

        return await call_next(request)
