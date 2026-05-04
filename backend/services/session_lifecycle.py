# -*- coding: utf-8 -*-
"""Hermes Agent - 会话生命周期管理服务

管理 MCP 会话的完整生命周期：
- Agent 连接时创建会话
- 工具调用时更新活跃时间
- 会话空闲超时自动触发知识提取
- Agent 断开时标记完成并触发知识提取
"""

import logging
import threading
import time
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger("hermes.session_lifecycle")
IDLE_TIMEOUT_SECONDS = 30 * 60


class SessionLifecycleManager:
    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._cleanup_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def on_agent_connect(self, mcp_session_id: str, agent_id: str) -> str:
        now = time.time()
        hermes_session_id = f"mcp_{mcp_session_id[:12]}"
        with self._lock:
            self._sessions[mcp_session_id] = {
                "agent_id": agent_id, "hermes_session_id": hermes_session_id,
                "last_activity": now, "state": "active",
                "tool_call_count": 0, "message_count": 0, "connected_at": now,
            }
        try:
            from backend.services.hermes_service import hermes_service as _hs
            agent_info = None
            try:
                from backend.services.agent_identity import agent_identity_manager
                agent_info = agent_identity_manager.get_agent(agent_id)
            except Exception:
                pass
            session_title = f"MCP Session ({agent_info['name'] if agent_info else agent_id})"
            _hs.create_session(session_id=hermes_session_id, title=session_title, source="mcp")
            try:
                from backend.services.agent_identity import agent_identity_manager
                agent_identity_manager.increment_stat(agent_id, "total_sessions")
            except Exception:
                pass
        except Exception as e:
            logger.warning(f"Failed to create hermes session: {e}")
        logger.info(f"Session lifecycle: connect {mcp_session_id[:12]}... (agent={agent_id})")
        return hermes_session_id

    def on_tool_call(self, mcp_session_id: str):
        with self._lock:
            if mcp_session_id in self._sessions:
                self._sessions[mcp_session_id]["last_activity"] = time.time()
                self._sessions[mcp_session_id]["state"] = "active"
                self._sessions[mcp_session_id]["tool_call_count"] += 1
                agent_id = self._sessions[mcp_session_id].get("agent_id")
                if agent_id:
                    try:
                        from backend.services.agent_identity import agent_identity_manager
                        agent_identity_manager.increment_stat(agent_id, "total_tool_calls")
                    except Exception:
                        pass

    def on_message(self, mcp_session_id: str):
        with self._lock:
            if mcp_session_id in self._sessions:
                self._sessions[mcp_session_id]["message_count"] += 1
                self._sessions[mcp_session_id]["last_activity"] = time.time()
                agent_id = self._sessions[mcp_session_id].get("agent_id")
                if agent_id:
                    try:
                        from backend.services.agent_identity import agent_identity_manager
                        agent_identity_manager.increment_stat(agent_id, "total_messages")
                    except Exception:
                        pass

    def on_agent_disconnect(self, mcp_session_id: str):
        session_info = None
        with self._lock:
            if mcp_session_id in self._sessions:
                session_info = self._sessions.pop(mcp_session_id)
                session_info["state"] = "completed"
        if not session_info:
            return
        hermes_session_id = session_info["hermes_session_id"]
        tool_count = session_info["tool_call_count"]
        msg_count = session_info["message_count"]
        logger.info(f"Session lifecycle: disconnect {mcp_session_id[:12]}... (tools={tool_count}, msgs={msg_count})")
        if tool_count > 0 or msg_count > 0:
            self._trigger_extraction(hermes_session_id)

    def _trigger_extraction(self, hermes_session_id: str):
        try:
            from backend.services.knowledge_extractor import KnowledgeExtractor
            extractor = KnowledgeExtractor()
            extracted = extractor.extract_from_session(hermes_session_id, auto_submit=True)
            if extracted:
                total = len(extracted.get("knowledge", [])) + len(extracted.get("experiences", [])) + len(extracted.get("memories", []))
                if total > 0:
                    logger.info(f"Session extraction: {hermes_session_id} -> {total} items")
        except Exception as e:
            logger.warning(f"Session extraction failed for {hermes_session_id}: {e}")

    def get_session_info(self, mcp_session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._sessions.get(mcp_session_id)

    def get_active_sessions(self) -> list:
        with self._lock:
            return [{**info, "mcp_session_id": sid} for sid, info in self._sessions.items() if info["state"] == "active"]

    def check_idle_sessions(self):
        now = time.time()
        with self._lock:
            for sid, info in self._sessions.items():
                if info["state"] == "active":
                    idle_seconds = now - info["last_activity"]
                    if idle_seconds > IDLE_TIMEOUT_SECONDS:
                        info["state"] = "idle"
                        logger.info(f"Session idle: {sid[:12]}... (idle={int(idle_seconds)}s)")

    def start_cleanup_thread(self):
        if self._cleanup_thread and self._cleanup_thread.is_alive():
            return
        self._stop_event.clear()
        def _cleanup_loop():
            while not self._stop_event.wait(60):
                try:
                    self.check_idle_sessions()
                except Exception as e:
                    logger.debug(f"Idle session check failed: {e}")
        self._cleanup_thread = threading.Thread(target=_cleanup_loop, daemon=True, name="session-lifecycle-cleanup")
        self._cleanup_thread.start()
        logger.info("Session lifecycle cleanup thread started")

    def stop_cleanup_thread(self):
        self._stop_event.set()
        if self._cleanup_thread:
            self._cleanup_thread.join(timeout=5)


session_lifecycle = SessionLifecycleManager()