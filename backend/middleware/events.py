# -*- coding: utf-8 -*-
"""Hermes Agent - 事件发射中间件

在关键 API 操作后自动发射 SSE 事件
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class EventEmitMiddleware(BaseHTTPMiddleware):
    """拦截 API 请求，在写操作后发射 SSE 事件"""

    # 需要发射事件的路径模式
    WRITE_PATTERNS = {
        "PUT": ["memory", "skills", "tools", "config", "cron"],
        "POST": ["skills", "cron", "sessions", "mcp"],
        "DELETE": ["sessions", "skills", "cron", "agents"],
    }

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # 只处理 API 路径的写操作
        path = request.url.path
        method = request.method

        if not path.startswith("/api/"):
            return response

        patterns = self.WRITE_PATTERNS.get(method, [])
        if any(p in path for p in patterns):
            try:
                from backend.routers.events import emit_event

                # 提取事件类型
                event_type = self._get_event_type(method, path)
                emit_event(
                    event_type=event_type,
                    data={"path": path, "method": method, "status": response.status_code},
                    source="api",
                )
            except Exception:
                pass  # 事件发射失败不影响主流程

        return response

    def _get_event_type(self, method: str, path: str) -> str:
        """根据方法和路径推断事件类型"""
        if "memory" in path:
            return "memory.updated"
        elif "skills" in path:
            if method == "POST":
                return "skill.created"
            elif method == "DELETE":
                return "skill.deleted"
            return "skill.updated"
        elif "tools" in path:
            return "tool.toggled"
        elif "cron" in path:
            if "trigger" in path:
                return "cron.triggered"
            elif method == "POST":
                return "cron.created"
            elif method == "DELETE":
                return "cron.deleted"
            return "cron.updated"
        elif "sessions" in path:
            if method == "DELETE":
                return "session.deleted"
            elif "compress" in path:
                return "session.compressed"
            return "session.updated"
        elif "config" in path:
            return "config.updated"
        elif "mcp" in path:
            return "mcp.restarted"
        return "api.call"
