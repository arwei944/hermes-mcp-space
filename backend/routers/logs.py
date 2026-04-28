# -*- coding: utf-8 -*-
"""Hermes Agent - 操作日志 API（JSON 持久化）"""

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/logs", tags=["logs"])

_MAX_LOGS = 500


def _get_log_path() -> Path:
    """获取日志文件路径"""
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    log_dir = Path(home) / "data"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "logs.json"


def _load_logs() -> List[Dict[str, Any]]:
    """从文件加载日志"""
    path = _get_log_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_logs(logs: List[Dict[str, Any]]) -> None:
    """保存日志到文件"""
    path = _get_log_path()
    try:
        path.write_text(json.dumps(logs[:_MAX_LOGS], ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def add_log(
    action: str,
    target: str = "",
    detail: str = "",
    level: str = "info",
    source: str = "system",
):
    """添加一条操作日志（持久化到文件），同时记录到最近活跃会话"""
    entry = {
        "id": f"log-{int(time.time() * 1000)}",
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "target": target,
        "detail": detail,
        "level": level,
        "source": source,
    }
    logs = _load_logs()
    logs.insert(0, entry)
    if len(logs) > _MAX_LOGS:
        logs = logs[:_MAX_LOGS]
    _save_logs(logs)

    # 自动记录系统消息到最近活跃会话（仅重要操作，排除对话记录本身）
    if source in ("mcp", "system") and level in ("info", "success"):
        # 排除 log_conversation 的日志，避免循环写入会话
        if "log_conversation" not in action and "记录对话" not in action:
            try:
                _auto_record_to_session(action, target, detail, source)
            except Exception:
                pass


def _auto_record_to_session(action: str, target: str, detail: str, source: str):
    """自动将操作记录到最近活跃会话"""
    from backend.services.hermes_service import HermesService
    service = HermesService()
    sessions = service.list_sessions()
    active = [s for s in sessions if s.get("status") == "active"]
    if not active:
        return
    # 取最近的活跃会话
    latest = active[0]
    session_id = latest.get("id") or latest.get("session_id")
    if not session_id:
        return

    # 构建系统消息
    source_label = {"mcp": "MCP", "system": "系统", "cron": "定时任务"}.get(source, source)
    msg_content = f"[{source_label}] {action}"
    if detail:
        msg_content += f" — {detail[:200]}"

    service.add_session_message(session_id, "system", msg_content)


@router.get("", summary="获取操作日志")
async def get_logs(
    limit: int = Query(default=100, le=200),
    level: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
):
    """获取操作日志列表，支持按级别和来源过滤"""
    logs = _load_logs()
    if level:
        logs = [l for l in logs if l["level"] == level]
    if source:
        logs = [l for l in logs if l["source"] == source]
    return logs[:limit]


@router.delete("", summary="清空日志")
async def clear_logs():
    """清空所有操作日志"""
    logs = _load_logs()
    count = len(logs)
    _save_logs([])
    return {"success": True, "message": f"已清空 {count} 条日志"}


@router.get("/stats", summary="日志统计")
async def get_log_stats():
    """获取日志统计信息"""
    from collections import Counter
    logs = _load_logs()
    levels = Counter(l["level"] for l in logs)
    sources = Counter(l["source"] for l in logs)
    actions = Counter(l["action"] for l in logs)
    return {
        "total": len(logs),
        "byLevel": dict(levels),
        "bySource": dict(sources),
        "topActions": dict(actions.most_common(10)),
    }
