# -*- coding: utf-8 -*-
"""Hermes Agent - Dashboard & Status API"""

import os
import time
from datetime import datetime
from fastapi import APIRouter

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api", tags=["system"])

_start_time = time.time()


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
    hours, _ = divmod(remainder, 3600)
    uptime_str = f"{days}天 {hours}小时" if days > 0 else f"{hours}小时"

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
            "memoryUsage": "-",
            "cpuUsage": "-",
        },
    }


@router.get("/status")
async def get_status():
    """System status overview"""
    mcp = hermes_service.get_mcp_status()
    return {
        "status": "ok",
        "version": os.environ.get("APP_VERSION", "1.0.0"),
        "uptime": int(time.time() - _start_time),
        "mcp": mcp.get("status", "unknown"),
        "hermes_available": hermes_service.hermes_available,
    }
