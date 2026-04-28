# -*- coding: utf-8 -*-
"""Hermes Agent - 操作日志 API"""

import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/logs", tags=["logs"])

# 内存日志存储（最多保留 500 条）
_log_store: List[Dict[str, Any]] = []
_MAX_LOGS = 500


def add_log(
    action: str,
    target: str = "",
    detail: str = "",
    level: str = "info",
    source: str = "system",
):
    """添加一条操作日志"""
    entry = {
        "id": f"log-{int(time.time() * 1000)}",
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "target": target,
        "detail": detail,
        "level": level,  # info, warning, error, success
        "source": source,  # system, user, mcp, cron
    }
    _log_store.insert(0, entry)
    # 限制数量
    if len(_log_store) > _MAX_LOGS:
        del _log_store[_MAX_LOGS:]


@router.get("", summary="获取操作日志")
async def get_logs(
    limit: int = Query(default=50, le=200),
    level: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
):
    """获取操作日志列表，支持按级别和来源过滤"""
    logs = _log_store
    if level:
        logs = [l for l in logs if l["level"] == level]
    if source:
        logs = [l for l in logs if l["source"] == source]
    return logs[:limit]


@router.delete("", summary="清空日志")
async def clear_logs():
    """清空所有操作日志"""
    count = len(_log_store)
    _log_store.clear()
    return {"success": True, "message": f"已清空 {count} 条日志"}


@router.get("/stats", summary="日志统计")
async def get_log_stats():
    """获取日志统计信息"""
    from collections import Counter
    levels = Counter(l["level"] for l in _log_store)
    sources = Counter(l["source"] for l in _log_store)
    actions = Counter(l["action"] for l in _log_store)
    return {
        "total": len(_log_store),
        "byLevel": dict(levels),
        "bySource": dict(sources),
        "topActions": dict(actions.most_common(10)),
    }
