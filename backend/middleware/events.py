# -*- coding: utf-8 -*-
"""Hermes Agent - 事件发射 + 操作日志中间件

在关键 API 操作后自动发射 SSE 事件并记录操作日志
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class EventEmitMiddleware(BaseHTTPMiddleware):
    """拦截 API 请求，在写操作后发射 SSE 事件 + 记录操作日志"""

    # 需要处理的路径模式
    WRITE_PATTERNS = {
        "PUT": ["memory", "skills", "tools", "config", "cron"],
        "POST": ["skills", "cron", "sessions", "mcp"],
        "DELETE": ["sessions", "skills", "cron", "agents"],
    }

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        path = request.url.path
        method = request.method

        if not path.startswith("/api/"):
            return response

        patterns = self.WRITE_PATTERNS.get(method, [])
        if any(p in path for p in patterns):
            try:
                from backend.routers.events import emit_event
                from backend.routers.logs import add_log

                event_type = self._get_event_type(method, path)
                detail = self._get_detail(method, path)

                # 发射 SSE 事件
                emit_event(
                    event_type=event_type,
                    data={"path": path, "method": method, "status": response.status_code},
                    source="api",
                )

                # 记录操作日志
                level = "success" if response.status_code < 400 else "error"
                add_log(
                    action=detail,
                    target=path,
                    detail=f"{method} {path} → {response.status_code}",
                    level=level,
                    source="user",
                )
            except Exception:
                pass

        return response

    def _get_event_type(self, method: str, path: str) -> str:
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

    def _get_detail(self, method: str, path: str) -> str:
        if "memory" in path:
            return "更新记忆"
        elif "skills" in path:
            actions = {"POST": "创建技能", "PUT": "更新技能", "DELETE": "删除技能"}
            return actions.get(method, "操作技能")
        elif "tools" in path:
            return "切换工具状态"
        elif "cron" in path:
            if "trigger" in path:
                return "触发定时任务"
            actions = {"POST": "创建定时任务", "PUT": "更新定时任务", "DELETE": "删除定时任务"}
            return actions.get(method, "操作定时任务")
        elif "sessions" in path:
            if method == "DELETE":
                return "删除会话"
            elif "compress" in path:
                return "压缩会话"
            return "操作会话"
        elif "config" in path:
            if "reset" in path:
                return "重置配置"
            return "更新配置"
        elif "mcp" in path:
            return "重启 MCP 服务"
        elif "agents" in path:
            return "终止 Agent"
        return "API 调用"
