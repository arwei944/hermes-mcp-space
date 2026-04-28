# -*- coding: utf-8 -*-
"""Hermes Agent - Dashboard & Status API"""

import os
import time
from datetime import datetime
from fastapi import APIRouter

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api", tags=["system"])

_start_time = time.time()


def _get_system_resources():
    """获取系统资源使用情况"""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem_mb = process.memory_info().rss / 1024 / 1024
        cpu_pct = process.cpu_percent(interval=0.5)
        # 系统总内存
        total_mem = psutil.virtual_memory().total / 1024 / 1024
        return f"{mem_mb:.0f}MB / {total_mem:.0f}MB", f"{cpu_pct:.1f}%"
    except ImportError:
        return "-", "-"
    except Exception:
        return "-", "-"


@router.get("/dashboard")
async def get_dashboard():
    """Dashboard data: stats + recent sessions + system status"""
    sessions = hermes_service.list_sessions()
    tools = hermes_service.list_tools()
    skills = hermes_service.list_skills()
    cron_jobs = hermes_service.list_cron_jobs()
    agents = hermes_service.list_agents()
    mcp = hermes_service.get_mcp_status()

    active_sessions = [s for s in sessions if s.get("status") == "active"]
    active_tools = [t for t in tools if t.get("status") == "active"]
    active_cron = [j for j in cron_jobs if j.get("status") == "active"]

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

    mem_usage, cpu_usage = _get_system_resources()

    return {
        "stats": {
            "sessions": len(sessions),
            "activeSessions": len(active_sessions),
            "tools": len(tools),
            "activeTools": len(active_tools),
            "skills": len(skills),
            "cronJobs": len(cron_jobs),
            "activeCronJobs": len(active_cron),
            "mcpConnected": mcp.get("status") == "running",
        },
        "recentSessions": sessions[:5],
        "systemStatus": {
            "uptime": uptime_str,
            "version": os.environ.get("APP_VERSION", "1.0.0"),
            "memoryUsage": mem_usage,
            "cpuUsage": cpu_usage,
        },
    }


@router.get("/status")
async def get_status():
    """System status overview"""
    mcp = hermes_service.get_mcp_status()
    remote_url = os.environ.get("HERMES_API_URL", "")
    return {
        "status": "ok",
        "version": os.environ.get("APP_VERSION", "1.0.0"),
        "uptime": int(time.time() - _start_time),
        "mcp": mcp.get("status", "unknown"),
        "hermes_available": hermes_service.hermes_available,
        "hermes_remote_url": remote_url if remote_url else None,
        "data_source": "远程 API" if remote_url else ("本地" if hermes_service.hermes_available else "降级数据"),
    }
