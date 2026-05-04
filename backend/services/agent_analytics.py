# -*- coding: utf-8 -*-
"""Hermes Agent - Agent 分析服务"""

import logging
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("hermes.agent_analytics")


class AgentAnalyticsService:
    def __init__(self):
        self._hermes_home = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))
        self._db_path = self._hermes_home / "data" / "knowledge.db"

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), timeout=5)
        conn.row_factory = sqlite3.Row
        return conn

    def get_agent_profile(self, agent_id: str) -> Dict[str, Any]:
        profile = {"agent_id": agent_id, "timestamp": datetime.now().isoformat()}
        try:
            conn = self._get_conn()
            agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if agent:
                for k in ["name", "role", "last_connected_at", "total_sessions", "total_messages", "total_tool_calls"]:
                    profile[k] = agent[k]
            conn.close()
        except Exception as e:
            logger.debug(f"Failed to get agent profile: {e}")
        try:
            conn = self._get_conn()
            kn = conn.execute("SELECT COUNT(*) FROM knowledge WHERE source LIKE ? AND is_active=1", (f"%{agent_id}%",)).fetchone()[0]
            exp = conn.execute("SELECT COUNT(*) FROM experiences WHERE source LIKE ? AND is_active=1", (f"%{agent_id}%",)).fetchone()[0]
            mem = conn.execute("SELECT COUNT(*) FROM memories WHERE source LIKE ? AND is_active=1", (f"%{agent_id}%",)).fetchone()[0]
            conn.close()
            profile["contributions"] = {"knowledge": kn, "experiences": exp, "memories": mem, "total": kn + exp + mem}
        except Exception:
            profile["contributions"] = {"knowledge": 0, "experiences": 0, "memories": 0, "total": 0}
        try:
            traces_path = self._hermes_home / "logs" / "tool_traces.jsonl"
            if traces_path.exists():
                import json
                lines = traces_path.read_text(encoding="utf-8", errors="replace").strip().split("\n")
                agent_calls = []
                for line in lines[-200:]:
                    try:
                        record = json.loads(line)
                        if record.get("agent") == agent_id:
                            agent_calls.append(record)
                    except Exception:
                        continue
                if agent_calls:
                    success = sum(1 for c in agent_calls if c.get("ok"))
                    profile["tool_stats"] = {
                        "total_calls": len(agent_calls), "success_calls": success,
                        "success_rate": round(success / len(agent_calls), 3),
                        "avg_latency_ms": round(sum(c.get("ms", 0) for c in agent_calls) / len(agent_calls)),
                    }
        except Exception:
            pass
        return profile

    def get_agent_leaderboard(self) -> list:
        try:
            conn = self._get_conn()
            agents = conn.execute("SELECT id, name, role, total_sessions, total_messages, total_tool_calls, last_connected_at FROM agents ORDER BY total_tool_calls DESC").fetchall()
            conn.close()
            return [dict(a) for a in agents]
        except Exception:
            return []

    def get_all_agents_summary(self) -> Dict[str, Any]:
        try:
            conn = self._get_conn()
            agents = conn.execute("SELECT id, name, role, last_connected_at, total_sessions, total_messages, total_tool_calls, is_active FROM agents ORDER BY last_connected_at DESC").fetchall()
            conn.close()
            return {"total": len(agents), "active": sum(1 for a in agents if a["is_active"]), "agents": [dict(a) for a in agents]}
        except Exception:
            return {"total": 0, "active": 0, "agents": []}


agent_analytics = AgentAnalyticsService()