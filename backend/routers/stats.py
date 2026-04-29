# -*- coding: utf-8 -*-
"""对话统计 API"""

from typing import Any, Dict, List
from fastapi import APIRouter, Query
from backend.services.hermes_service import hermes_service

router = APIRouter(tags=["stats"])


@router.get("/stats/messages", summary="消息统计")
async def message_stats(days: int = Query(default=7, ge=1, le=90)) -> Dict[str, Any]:
    """返回过去 N 天的消息统计"""
    import sqlite3
    from backend.config import get_hermes_home
    db_path = get_hermes_home() / "sessions.db"
    if not db_path.exists():
        return {"total": 0, "by_date": [], "by_role": {}}

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # 按日期统计
    cursor.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM messages
        WHERE created_at >= DATE('now', ?)
        GROUP BY DATE(created_at)
        ORDER BY date
    """, (f"-{days} days",))
    by_date = [{"date": row[0], "count": row[1]} for row in cursor.fetchall()]

    # 按角色统计
    cursor.execute("""
        SELECT role, COUNT(*) as count
        FROM messages
        GROUP BY role
    """)
    by_role = {row[0]: row[1] for row in cursor.fetchall()}

    # 总数
    cursor.execute("SELECT COUNT(*) FROM messages")
    total = cursor.fetchone()[0]

    conn.close()
    return {"total": total, "by_date": by_date, "by_role": by_role, "days": days}


@router.get("/stats/sessions", summary="会话统计")
async def session_stats(days: int = Query(default=7, ge=1, le=90)) -> Dict[str, Any]:
    """返回过去 N 天的会话统计"""
    import sqlite3
    from backend.config import get_hermes_home
    db_path = get_hermes_home() / "sessions.db"
    if not db_path.exists():
        return {"total": 0, "by_date": [], "avg_messages": 0}

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # 按日期统计
    cursor.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM sessions
        WHERE created_at >= DATE('now', ?)
        GROUP BY DATE(created_at)
        ORDER BY date
    """, (f"-{days} days",))
    by_date = [{"date": row[0], "count": row[1]} for row in cursor.fetchall()]

    # 总数
    cursor.execute("SELECT COUNT(*) FROM sessions")
    total = cursor.fetchone()[0]

    # 平均消息数
    cursor.execute("""
        SELECT AVG(msg_count) FROM (
            SELECT session_id, COUNT(*) as msg_count
            FROM messages
            GROUP BY session_id
        )
    """)
    avg = cursor.fetchone()[0] or 0

    conn.close()
    return {"total": total, "by_date": by_date, "avg_messages": round(avg, 1), "days": days}


@router.get("/stats/tools", summary="工具调用统计")
async def tool_stats(days: int = Query(default=7, ge=1, le=90)) -> Dict[str, Any]:
    """返回过去 N 天的工具调用统计"""
    try:
        from backend.services.eval_service import eval_service
        return eval_service.get_tool_stats()
    except Exception:
        return {"tools": [], "total": 0}
