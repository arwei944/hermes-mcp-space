# -*- coding: utf-8 -*-
"""Hermes Agent - 用户反馈服务"""

import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("hermes.feedback")


class FeedbackService:
    def __init__(self):
        self._hermes_home = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))
        self._db_path = self._hermes_home / "data" / "knowledge.db"
        self._ensure_table()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), timeout=5)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_table(self):
        try:
            conn = self._get_conn()
            conn.execute("""CREATE TABLE IF NOT EXISTS feedbacks (
                id TEXT PRIMARY KEY, agent_id TEXT DEFAULT '', session_id TEXT DEFAULT '',
                target_type TEXT NOT NULL, target_id TEXT DEFAULT '',
                rating INTEGER NOT NULL DEFAULT 3, comment TEXT DEFAULT '', created_at TEXT NOT NULL
            )""")
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to ensure feedbacks table: {e}")

    def submit(self, agent_id="", session_id="", target_type="response", target_id="", rating=3, comment="") -> Dict[str, Any]:
        import uuid
        feedback_id = f"fb_{uuid.uuid4().hex[:12]}"
        now = datetime.now().isoformat()
        try:
            conn = self._get_conn()
            conn.execute("INSERT INTO feedbacks (id,agent_id,session_id,target_type,target_id,rating,comment,created_at) VALUES (?,?,?,?,?,?,?,?)",
                (feedback_id, agent_id, session_id, target_type, target_id, rating, comment, now))
            conn.commit()
            conn.close()
            return {"success": True, "id": feedback_id}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_contribution_score(self, target_type: str, target_id: str) -> float:
        try:
            conn = self._get_conn()
            rows = conn.execute("SELECT rating FROM feedbacks WHERE target_type=? AND target_id=?", (target_type, target_id)).fetchall()
            conn.close()
            if not rows:
                return 0.0
            total = len(rows)
            positive = sum(1 for r in rows if r["rating"] >= 4)
            negative = sum(1 for r in rows if r["rating"] <= 2)
            return round((positive * 1.0 - negative * 0.5) / total, 3)
        except Exception:
            return 0.0

    def get_stats(self) -> Dict[str, Any]:
        try:
            conn = self._get_conn()
            total = conn.execute("SELECT COUNT(*) FROM feedbacks").fetchone()[0]
            avg_rating = conn.execute("SELECT AVG(rating) FROM feedbacks").fetchone()[0]
            by_type = conn.execute("SELECT target_type, COUNT(*), AVG(rating) FROM feedbacks GROUP BY target_type").fetchall()
            conn.close()
            return {"total": total, "avg_rating": round(avg_rating, 2) if avg_rating else 0,
                    "by_type": {r[0]: {"count": r[1], "avg": round(r[2], 2)} for r in by_type}}
        except Exception:
            return {"total": 0, "avg_rating": 0, "by_type": {}}


feedback_service = FeedbackService()