# -*- coding: utf-8 -*-
"""Hermes Agent - Dashboard & Status API (v2 实时监控台)"""

import json
import os
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from fastapi import APIRouter, Query
from typing import Any, Dict, List, Optional

from backend.services.hermes_service import hermes_service
from backend.services import eval_service
from backend.routers.logs import _load_logs

router = APIRouter(prefix="/api", tags=["system"])

_start_time = time.time()


def _get_first_deploy_time() -> datetime:
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    deploy_file = Path(home) / "data" / "first_deploy.json"
    if deploy_file.exists():
        try:
            data = json.loads(deploy_file.read_text(encoding="utf-8"))
            return datetime.fromisoformat(data["first_deploy"])
        except Exception:
            pass
    deploy_file.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now()
    deploy_file.write_text(json.dumps({"first_deploy": now.isoformat()}, ensure_ascii=False), encoding="utf-8")
    return now


def _get_system_resources():
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem_mb = process.memory_info().rss / 1024 / 1024
        cpu_pct = process.cpu_percent(interval=0.3)
        total_mem = psutil.virtual_memory().total / 1024 / 1024
        return f"{mem_mb:.0f}MB / {total_mem:.0f}MB", f"{cpu_pct:.1f}%", mem_mb, total_mem, cpu_pct
    except ImportError:
        return "-", "-", 0, 0, 0
    except Exception:
        return "-", "-", 0, 0, 0


# ============================================================
# v2 新增：实时活动流
# ============================================================

@router.get("/dashboard/activity")
async def get_activity(limit: int = Query(default=30, le=100)):
    """实时活动流：合并工具调用追踪 + 操作日志，按时间倒序"""
    activities = []

    # 1. 从 tool_traces.jsonl 读取最近工具调用
    traces = eval_service._read_all_records()
    for t in traces[-50:]:
        ts = t.get("ts", "")
        activities.append({
            "ts": ts,
            "type": "tool_call",
            "tool": t.get("tool", "?"),
            "ok": t.get("ok", False),
            "ms": t.get("ms", 0),
            "err": (t.get("err", "") or "")[:100],
            "src": t.get("src", "mcp"),
            "args_summary": _summarize_args(t.get("args", {})),
        })

    # 2. 从 logs.json 读取操作日志
    logs = _load_logs()
    for log in logs[:50]:
        activities.append({
            "ts": log.get("timestamp", ""),
            "type": "log",
            "action": log.get("action", ""),
            "target": log.get("target", ""),
            "detail": (log.get("detail", "") or "")[:100],
            "level": log.get("level", "info"),
            "source": log.get("source", "system"),
        })

    # 按时间倒序
    activities.sort(key=lambda x: x.get("ts", ""), reverse=True)
    return activities[:limit]


def _summarize_args(args: Dict[str, Any], max_len: int = 60) -> str:
    """将工具调用参数摘要为一行文本"""
    if not args:
        return ""
    parts = []
    for k, v in list(args.items())[:3]:
        sv = str(v)
        if len(sv) > 30:
            sv = sv[:30] + "..."
        parts.append(f"{k}={sv}")
    result = ", ".join(parts)
    if len(result) > max_len:
        result = result[:max_len] + "..."
    return result


# ============================================================
# v2 新增：工具调用热力图 (24h)
# ============================================================

@router.get("/dashboard/heatmap")
async def get_heatmap():
    """工具调用热力图：最近 24 小时，按小时 x 工具名 分组"""
    records = eval_service._read_all_records()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)

    # 获取所有工具名
    all_tools = sorted(set(r.get("tool", "unknown") for r in records))

    # 初始化 24h x tools 矩阵
    hours = list(range(24))
    current_hour = now.hour
    # 按从当前小时往前排
    ordered_hours = [(current_hour - i) % 24 for i in range(24)][::-1]

    matrix = defaultdict(int)
    for r in records:
        ts_str = r.get("ts", "")
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if ts < cutoff:
                continue
            hour = ts.hour
            tool = r.get("tool", "unknown")
            matrix[(hour, tool)] += 1
        except (ValueError, TypeError):
            continue

    # 找到最大值用于归一化
    max_val = max(matrix.values()) if matrix else 1

    return {
        "hours": ordered_hours,
        "tools": all_tools,
        "matrix": {f"{h}_{t}": matrix.get((h, t), 0) for h in ordered_hours for t in all_tools},
        "max": max_val,
    }


# ============================================================
# v2 新增：工具调用排行
# ============================================================

@router.get("/dashboard/ranking")
async def get_ranking():
    """工具调用排行 TOP 15"""
    stats = eval_service.get_tool_stats()
    return stats[:15]


# ============================================================
# v2 新增：错误追踪
# ============================================================

@router.get("/dashboard/errors")
async def get_errors(limit: int = Query(default=10, le=50)):
    """最近的工具调用错误列表"""
    records = eval_service._read_all_records()
    errors = [r for r in records if not r.get("ok")]
    errors.reverse()  # 最新的在前
    return errors[:limit]


# ============================================================
# v2 新增：会话活跃度趋势 (真实数据)
# ============================================================

@router.get("/dashboard/trend")
async def get_trend(days: int = Query(default=7, le=30)):
    """会话 + 工具调用 趋势（真实数据）"""
    tool_trend = eval_service.get_trend(days)

    # 会话趋势：从 sessions 列表按日期聚合
    sessions = hermes_service.list_sessions()
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    session_daily = defaultdict(int)
    for s in sessions:
        ts_str = s.get("created_at", s.get("timestamp", ""))
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if ts >= cutoff:
                session_daily[ts.strftime("%Y-%m-%d")] += 1
        except (ValueError, TypeError):
            continue

    # 合并
    result = []
    for item in tool_trend:
        date_key = item["date"]
        result.append({
            "date": date_key,
            "tool_calls": item["total_calls"],
            "tool_success": item["success_count"],
            "tool_fail": item["fail_count"],
            "tool_success_rate": item["success_rate"],
            "sessions": session_daily.get(date_key, 0),
        })

    return result


# ============================================================
# 原有端点增强
# ============================================================

@router.get("/dashboard")
async def get_dashboard():
    """Dashboard 主数据（v2 增强）"""
    sessions = hermes_service.list_sessions()
    tools = hermes_service.list_tools()
    skills = hermes_service.list_skills()
    cron_jobs = hermes_service.list_cron_jobs()
    mcp = hermes_service.get_mcp_status()

    # 工具调用统计
    eval_summary = eval_service.get_eval_summary()

    active_sessions = [s for s in sessions if s.get("status") == "active"]

    uptime_seconds = int(time.time() - _start_time)
    days, remainder = divmod(uptime_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    if days > 0:
        uptime_str = f"{days}天 {hours}小时 {minutes}分钟"
    elif hours > 0:
        uptime_str = f"{hours}小时 {minutes}分钟"
    else:
        uptime_str = f"{minutes}分钟"

    mem_str, cpu_str, mem_mb, total_mem, cpu_pct = _get_system_resources()

    return {
        "stats": {
            "sessions": len(sessions),
            "activeSessions": len(active_sessions),
            "tools": len(tools),
            "skills": len(skills),
            "cronJobs": len(cron_jobs),
            "mcpConnected": mcp.get("status") == "running",
            # v2 新增
            "totalToolCalls": eval_summary["total_calls"],
            "successRate": eval_summary["success_rate"],
            "avgLatency": eval_summary["avg_latency_ms"],
        },
        "recentSessions": sessions[:5],
        "systemStatus": {
            "uptime": uptime_str,
            "version": os.environ.get("APP_VERSION", "4.0.0"),
            "memoryUsage": mem_str,
            "cpuUsage": cpu_str,
            "memMb": mem_mb,
            "totalMemMb": total_mem,
            "cpuPct": cpu_pct,
        },
    }


@router.get("/status")
async def get_status():
    mcp = hermes_service.get_mcp_status()
    remote_url = os.environ.get("HERMES_API_URL", "")
    first_deploy = _get_first_deploy_time()
    total_uptime = int((datetime.now() - first_deploy).total_seconds())
    return {
        "status": "ok",
        "version": os.environ.get("APP_VERSION", "4.0.0"),
        "uptime": int(time.time() - _start_time),
        "total_uptime": total_uptime,
        "first_deploy": first_deploy.isoformat(),
        "mcp": mcp.get("status", "unknown"),
        "hermes_available": hermes_service.hermes_available,
        "hermes_remote_url": remote_url if remote_url else None,
        "data_source": "远程 API" if remote_url else ("本地" if hermes_service.hermes_available else "降级数据"),
    }
