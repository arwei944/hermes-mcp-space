# -*- coding: utf-8 -*-
"""Hermes Agent - Agent 身份注册服务

管理通过 MCP 连接的 Agent 身份信息。每个 Agent 连接时自动注册，
后续所有操作都携带 agent_id，形成可追溯的贡献记录。
"""

import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("hermes.agent_identity")

CLIENT_ROLE_MAP = {
    "trae": "coder", "cursor": "coder", "windsurf": "coder", "cline": "coder",
    "claude": "researcher", "claude-desktop": "researcher", "continue": "coder", "aider": "coder",
}

AGENT_ROLES = {
    "coder": {"label": "代码实践记录者", "description": "专注于编程实践，记录代码经验、坑、最佳实践"},
    "researcher": {"label": "知识采集记录者", "description": "专注于信息研究，提炼结构化知识"},
    "general": {"label": "通用助手", "description": "通用角色，记录所有类型的知识"},
}


class AgentIdentityManager:
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
            conn.execute("""
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'general',
                    description TEXT DEFAULT '', client_name TEXT DEFAULT '', client_version TEXT DEFAULT '',
                    capabilities TEXT DEFAULT '', last_connected_at TEXT NOT NULL,
                    total_sessions INTEGER DEFAULT 0, total_messages INTEGER DEFAULT 0,
                    total_tool_calls INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                )""")
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Failed to ensure agents table: {e}")

    def infer_role(self, client_name: str) -> str:
        if not client_name:
            return "general"
        name_lower = client_name.lower()
        for key, role in CLIENT_ROLE_MAP.items():
            if key in name_lower:
                return role
        return "general"

    def register_or_update(self, client_info: Dict[str, Any]) -> Dict[str, Any]:
        client_name = client_info.get("name", "unknown")
        client_version = client_info.get("version", "")
        role = self.infer_role(client_name)
        now = datetime.now().isoformat()
        agent_id = f"agent_{client_name.lower().replace(' ', '-').replace('/', '-')}"
        try:
            conn = self._get_conn()
            existing = conn.execute("SELECT id FROM agents WHERE id = ?", (agent_id,)).fetchone()
            if existing:
                conn.execute("UPDATE agents SET name=?, role=?, client_name=?, client_version=?, last_connected_at=?, is_active=1, updated_at=? WHERE id=?",
                    (client_name, role, client_name, client_version, now, now, agent_id))
            else:
                role_info = AGENT_ROLES.get(role, AGENT_ROLES["general"])
                conn.execute("INSERT INTO agents (id,name,role,description,client_name,client_version,last_connected_at,total_sessions,total_messages,total_tool_calls,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,0,0,1,?,?)",
                    (agent_id, client_name, role, role_info["description"], client_name, client_version, now, now, now))
            conn.commit()
            conn.close()
            logger.info(f"Agent registered: {agent_id} (role={role}, client={client_name})")
            return self.get_agent(agent_id) or {"id": agent_id, "role": role}
        except Exception as e:
            logger.error(f"Failed to register agent: {e}")
            return {"id": agent_id, "role": role, "error": str(e)}

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        try:
            conn = self._get_conn()
            row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            logger.debug(f"Failed to get agent {agent_id}: {e}")
            return None

    def increment_stat(self, agent_id: str, field: str, amount: int = 1):
        try:
            conn = self._get_conn()
            conn.execute(f"UPDATE agents SET {field} = {field} + ?, updated_at = ? WHERE id = ?",
                (amount, datetime.now().isoformat(), agent_id))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.debug(f"Failed to increment {field} for {agent_id}: {e}")

    def list_agents(self) -> list:
        try:
            conn = self._get_conn()
            rows = conn.execute("SELECT * FROM agents ORDER BY last_connected_at DESC").fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception:
            return []

    def deactivate(self, agent_id: str):
        try:
            conn = self._get_conn()
            conn.execute("UPDATE agents SET is_active=0, updated_at=? WHERE id=?", (datetime.now().isoformat(), agent_id))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.debug(f"Failed to deactivate {agent_id}: {e}")


agent_identity_manager = AgentIdentityManager()