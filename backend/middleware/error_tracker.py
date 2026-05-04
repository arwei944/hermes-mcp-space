# -*- coding: utf-8 -*-
"""API 错误追踪中间件

- 注入 X-Trace-Id 请求追踪头
- 记录请求耗时（X-Duration-Ms）
- 捕获未处理异常并记录到内存 + JSONL 持久化
- 异常时发送 SSE 事件 "api.error"
"""

import json
import logging
import time
import traceback
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("hermes-mcp")

# ---- 常量 ----
_MEMORY_MAXLEN = 200            # 内存 deque 最大条数
_JSONL_MAX_LINES = 1000         # JSONL 文件最大行数

# 跳过追踪的路径
_SKIP_PATHS = {"/", "/api/health", "/api/status", "/docs", "/redoc", "/openapi.json"}

# ---- 内存存储 ----
_api_error_store: deque = deque(maxlen=_MEMORY_MAXLEN)


# ============================================================
# JSONL 持久化
# ============================================================

def _get_log_dir() -> Path:
    """获取日志目录"""
    try:
        from backend.config import get_hermes_home
        log_dir = get_hermes_home() / "logs"
    except ImportError:
        log_dir = Path.home() / ".hermes" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def _get_jsonl_path() -> Path:
    """获取 API 错误 JSONL 文件路径"""
    return _get_log_dir() / "api_errors.jsonl"


def _append_jsonl(record: Dict[str, Any]) -> None:
    """追加一条记录到 JSONL 文件，超过上限自动裁剪"""
    try:
        jsonl_path = _get_jsonl_path()
        with open(jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

        # 自动裁剪
        try:
            with open(jsonl_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            if len(lines) > _JSONL_MAX_LINES:
                trimmed = lines[-_JSONL_MAX_LINES:]
                with open(jsonl_path, "w", encoding="utf-8") as f:
                    f.writelines(trimmed)
                logger.info(f"API 错误 JSONL 裁剪完成: {len(lines)} → {len(trimmed)} 行")
        except Exception as e:
            logger.warning(f"API 错误 JSONL 裁剪失败: {e}")
    except Exception as e:
        logger.warning(f"写入 API 错误 JSONL 失败: {e}")


# ============================================================
# 公共接口：供 ops.py 查询 API 错误
# ============================================================

def get_api_errors(
    status: Optional[int] = None,
    limit: int = 50,
) -> list:
    """获取 API 错误列表（最新的在前）

    Args:
        status: 按状态码过滤
        limit: 返回条数上限

    Returns:
        错误记录列表
    """
    errors = list(_api_error_store)
    if status is not None:
        errors = [e for e in errors if e.get("status_code") == status]
    errors.reverse()
    return errors[:limit]


def get_api_error_stats() -> Dict[str, Any]:
    """获取 API 错误统计"""
    errors = list(_api_error_store)

    # 按状态码分组
    status_counts: Dict[int, int] = {}
    for e in errors:
        code = e.get("status_code", 500)
        status_counts[code] = status_counts.get(code, 0) + 1

    # 按路径分组
    path_counts: Dict[str, int] = {}
    for e in errors:
        p = e.get("path", "")
        if p:
            path_counts[p] = path_counts.get(p, 0) + 1

    # 最近 1 小时
    now = time.time()
    one_hour_ago = now - 3600
    recent_count = 0
    for e in errors:
        try:
            ts = datetime.fromisoformat(e.get("timestamp", "")).timestamp()
            if ts >= one_hour_ago:
                recent_count += 1
        except (ValueError, TypeError):
            continue

    return {
        "total": len(errors),
        "by_status": status_counts,
        "by_path": dict(sorted(path_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
        "recent_1h_count": recent_count,
        "store_size": len(errors),
        "store_max": _MEMORY_MAXLEN,
    }


# ============================================================
# 中间件
# ============================================================

class ErrorTrackerMiddleware(BaseHTTPMiddleware):
    """API 错误追踪中间件

    - 注入 X-Trace-Id（从请求头获取或自动生成）
    - 记录 X-Duration-Ms 响应耗时
    - 捕获未处理异常并持久化
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # 跳过静态资源和不需要追踪的路径
        if path in _SKIP_PATHS or path.startswith("/static") or path.startswith("/favicon"):
            return await call_next(request)

        # 获取或生成 Trace ID
        trace_id = request.headers.get("x-trace-id", str(uuid.uuid4())[:8])

        start_time = time.time()

        try:
            response = await call_next(request)
        except Exception as exc:
            # 捕获未处理异常
            duration_ms = round((time.time() - start_time) * 1000, 2)

            # 构造错误记录
            record = {
                "id": str(uuid.uuid4())[:8],
                "trace_id": trace_id,
                "method": request.method,
                "path": path,
                "query": str(request.query_params) if request.query_params else None,
                "status_code": 500,
                "error_type": type(exc).__name__,
                "error_message": str(exc)[:500],
                "stack_trace": traceback.format_exc()[-1000:],  # 限制堆栈长度
                "duration_ms": duration_ms,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

            # 存入内存
            _api_error_store.append(record)

            # 持久化
            _append_jsonl(record)

            # Auto-submit API errors as experiences
            try:
                from backend.services.review_service import ReviewService
                svc = ReviewService()
                svc.submit_review(
                    target_type="experience",
                    action="create",
                    title=f"API Error: {request.url}",
                    content=f"Path: {request.url}\nMethod: {request.method}\nStatus: {record.get('status_code', 500)}\nError: {str(exc)[:500]}",
                    category="error_pattern",
                    confidence=0.6,
                    priority="normal",
                    reason="Auto-captured from ErrorTracker middleware",
                )
            except Exception:
                pass

            # 发送 SSE 事件
            try:
                from backend.routers.events import emit_event
                emit_event("api.error", record, source="error-tracker")
            except Exception:
                pass

            logger.error(f"[{trace_id}] 未处理异常 {request.method} {path}: {exc}")

            # 重新抛出，让 FastAPI 的默认异常处理器返回 500
            raise

        # 计算耗时
        duration_ms = round((time.time() - start_time) * 1000, 2)

        # 注入响应头
        response.headers["X-Trace-Id"] = trace_id
        response.headers["X-Duration-Ms"] = str(duration_ms)

        return response
