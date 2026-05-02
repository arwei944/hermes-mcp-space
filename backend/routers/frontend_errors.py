# -*- coding: utf-8 -*-
"""Hermes Agent - 前端错误上报 API

接收前端 sendBeacon 发送的 JS 错误/警告/API 错误/构建错误报告，
提供查询和统计接口。使用内存 deque + JSONL 持久化双重存储。
"""

import json
import logging
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

logger = logging.getLogger("hermes-mcp")

router = APIRouter(prefix="/api/ops", tags=["frontend-errors"])

# ---- 常量 ----
_MEMORY_MAXLEN = 500            # 内存 deque 最大条数
_JSONL_MAX_LINES = 2000         # JSONL 文件最大行数

# ---- 内存存储 ----
_error_store: deque = deque(maxlen=_MEMORY_MAXLEN)


# ============================================================
# 请求体模型
# ============================================================

class FrontendErrorReport(BaseModel):
    """前端错误上报请求体（兼容 sendBeacon）"""
    type: str = Field(default="js_error", description="错误类型: js_error | js_warn | api_error | build_error")
    message: str = Field(..., description="错误消息")
    stack: Optional[str] = Field(default=None, description="错误堆栈")
    context: Optional[str] = Field(default=None, description="附加上下文")
    url: Optional[str] = Field(default=None, description="发生错误的页面 URL")
    browser: Optional[str] = Field(default=None, description="浏览器信息")
    build_version: Optional[str] = Field(default=None, description="构建版本号")
    count: Optional[int] = Field(default=1, description="批量上报时的错误次数")


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
    """获取 JSONL 文件路径"""
    return _get_log_dir() / "frontend_errors.jsonl"


def _append_jsonl(record: Dict[str, Any]) -> None:
    """追加一条记录到 JSONL 文件，超过上限自动裁剪"""
    try:
        jsonl_path = _get_jsonl_path()
        with open(jsonl_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

        # 自动裁剪：超过最大行数时保留最新的
        try:
            with open(jsonl_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            if len(lines) > _JSONL_MAX_LINES:
                trimmed = lines[-_JSONL_MAX_LINES:]
                with open(jsonl_path, "w", encoding="utf-8") as f:
                    f.writelines(trimmed)
                logger.info(f"JSONL 裁剪完成: {len(lines)} → {len(trimmed)} 行")
        except Exception as e:
            logger.warning(f"JSONL 裁剪失败: {e}")
    except Exception as e:
        logger.warning(f"写入 JSONL 失败: {e}")


# ============================================================
# API 端点
# ============================================================

@router.post("/frontend-errors", summary="上报前端错误")
async def report_frontend_error(report: FrontendErrorReport) -> Dict[str, Any]:
    """接收前端 sendBeacon 发送的错误报告，存储并推送 SSE 事件"""
    record = {
        "id": str(uuid.uuid4())[:8],
        "type": report.type,
        "message": report.message,
        "stack": report.stack,
        "context": report.context,
        "url": report.url,
        "browser": report.browser,
        "build_version": report.build_version,
        "count": report.count or 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # 存入内存
    _error_store.append(record)

    # 持久化到 JSONL
    _append_jsonl(record)

    # 发送 SSE 事件
    try:
        from backend.routers.events import emit_event
        emit_event("frontend.error", record, source="frontend")
    except ImportError:
        logger.warning("emit_event 不可用，跳过 SSE 推送")
    except Exception as e:
        logger.warning(f"发送前端错误 SSE 事件失败: {e}")

    logger.info(f"前端错误上报: [{report.type}] {report.message[:80]}")
    return {"success": True, "id": record["id"]}


@router.get("/frontend-errors", summary="查询前端错误列表")
async def list_frontend_errors(
    type: Optional[str] = Query(default=None, description="按类型过滤: js_error | js_warn | api_error | build_error"),
    limit: int = Query(default=50, ge=1, le=500, description="返回条数上限"),
) -> List[Dict[str, Any]]:
    """获取前端错误列表（最新的在前）"""
    errors = list(_error_store)

    # 按类型过滤
    if type:
        errors = [e for e in errors if e.get("type") == type]

    # 最新的在前
    errors.reverse()
    return errors[:limit]


@router.get("/frontend-errors/stats", summary="前端错误统计")
async def frontend_error_stats() -> Dict[str, Any]:
    """获取前端错误统计数据"""
    errors = list(_error_store)

    # 按类型分组统计
    type_counts: Dict[str, int] = {}
    for e in errors:
        t = e.get("type", "unknown")
        type_counts[t] = type_counts.get(t, 0) + (e.get("count", 1) or 1)

    # 最近 1 小时错误数
    now = time.time()
    one_hour_ago = now - 3600
    recent_count = 0
    for e in errors:
        try:
            ts = datetime.fromisoformat(e.get("timestamp", "")).timestamp()
            if ts >= one_hour_ago:
                recent_count += (e.get("count", 1) or 1)
        except (ValueError, TypeError):
            continue

    # 按消息去重统计（取前 10 个高频错误）
    message_counts: Dict[str, int] = {}
    for e in errors:
        msg = e.get("message", "")
        if msg:
            message_counts[msg] = message_counts.get(msg, 0) + (e.get("count", 1) or 1)
    top_errors = sorted(message_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "total": sum(type_counts.values()),
        "by_type": type_counts,
        "recent_1h_count": recent_count,
        "top_errors": [{"message": msg, "count": cnt} for msg, cnt in top_errors],
        "store_size": len(errors),
        "store_max": _MEMORY_MAXLEN,
    }
