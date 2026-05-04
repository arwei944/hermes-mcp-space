# -*- coding: utf-8 -*-
"""AnalyticsService — 分析统计服务 (v9)"""

import json, logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from backend.config import get_hermes_home

logger = logging.getLogger("hermes-mcp")

class AnalyticsService:
    def __init__(self, session_service):
        self._session = session_service

    @property
    def hermes_available(self) -> bool:
        if not hasattr(self, '_hermes_available') or self._hermes_available is None:
            import os
            if os.environ.get("HERMES_API_URL", "").rstrip("/"): self._hermes_available = True
            else:
                try:
                    import hermes
                    self._hermes_available = True
                except ImportError: self._hermes_available = False
        return self._hermes_available

    def get_analytics_overview(self) -> Dict[str, Any]:
        sessions = self._session.list_sessions()
        messages_data = self._session._load_messages()
        messages = messages_data.get("messages", {})
        total_sessions = len(sessions)
        total_messages = sum(len(msgs) for msgs in messages.values())
        active = sum(1 for s in sessions if s.get("status") == "active")
        today = datetime.now().strftime("%Y-%m-%d")
        today_sessions = len([s for s in sessions if str(s.get("created_at", "")).startswith(today)])
        avg_messages = round(total_messages / total_sessions, 1) if total_sessions > 0 else 0
        return {"total_sessions": total_sessions, "total_messages": total_messages, "active_sessions": active, "today_sessions": today_sessions, "avg_messages_per_session": avg_messages}

    def get_analytics_trends(self, period: str = "daily", days: int = 30) -> Dict[str, Any]:
        sessions = self._session.list_sessions()
        now = datetime.now()
        trends = []
        if period == "daily":
            for i in range(days - 1, -1, -1):
                date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
                count = len([s for s in sessions if str(s.get("created_at", ""))[:10] == date])
                trends.append({"date": date, "count": count})
        return {"period": period, "days": days, "trends": trends}

    def get_analytics_distribution(self) -> Dict[str, Any]:
        sessions = self._session.list_sessions()
        model_dist, source_dist = {}, {}
        for s in sessions:
            model_dist[s.get("model", "unknown")] = model_dist.get(s.get("model", "unknown"), 0) + 1
            source_dist[s.get("source", "unknown")] = source_dist.get(s.get("source", "unknown"), 0) + 1
        return {"by_model": model_dist, "by_source": source_dist}

    def get_analytics_tools(self, days: int = 7) -> Dict[str, Any]:
        logs_path = get_hermes_home() / "data" / "logs.json"
        if not logs_path.exists(): return {"tools": [], "period_days": days, "total_calls": 0}
        try: logs = json.loads(logs_path.read_text(encoding="utf-8"))
        except Exception: return {"tools": [], "period_days": days, "total_calls": 0}
        return {"tools": [], "period_days": days, "total_calls": 0}

    def get_analytics_behavior(self) -> Dict[str, Any]:
        sessions = self._session.list_sessions()
        messages_data = self._session._load_messages()
        messages = messages_data.get("messages", {})
        role_counts = {"user": 0, "assistant": 0, "system": 0}
        for sid, msgs in messages.items():
            for m in msgs: role_counts[m.get("role", "unknown")] = role_counts.get(m.get("role", "unknown"), 0) + 1
        return {"message_distribution": role_counts, "total_messages": sum(role_counts.values())}

    def get_system_status(self) -> Dict[str, Any]:
        return {"status": "running", "message": "MCP 服务运行中", "port": 7860, "endpoint": "/mcp", "protocol": "Streamable HTTP + SSE", "hermes_available": self.hermes_available}

    def get_dashboard_summary(self) -> Dict[str, Any]:
        sessions = self._session.list_sessions()
        active = [s for s in sessions if s.get("status") == "active"]
        overview = self.get_analytics_overview()
        return {"total_sessions": len(sessions), "active_sessions": len(active), "total_messages": overview.get("total_messages", 0), "today_sessions": overview.get("today_sessions", 0), "smartness_index": self.get_smartness_index()}

    def get_smartness_index(self) -> Dict[str, Any]:
        scores = {}
        try:
            from backend.services.eval_service import eval_service
            summary = eval_service.get_eval_summary()
            total = summary.get("total_calls", 0)
            success = summary.get("success_calls", 0)
            scores["tool_success_rate"] = round(success / total, 3) if total > 0 else 0.5
        except Exception: scores["tool_success_rate"] = 0.5
        try:
            from backend.services.feedback_service import feedback_service
            stats = feedback_service.get_stats()
            scores["user_satisfaction"] = stats.get("avg_rating", 3) / 5.0
        except Exception: scores["user_satisfaction"] = 0.5
        try:
            import sqlite3
            db_path = get_hermes_home() / "data" / "knowledge.db"
            conn = sqlite3.connect(str(db_path), timeout=5)
            total_kn = conn.execute("SELECT COUNT(*) FROM knowledge WHERE is_active=1").fetchone()[0]
            viewed_kn = conn.execute("SELECT COUNT(*) FROM knowledge WHERE is_active=1 AND view_count>0").fetchone()[0]
            conn.close()
            scores["knowledge_hit_rate"] = round(viewed_kn / total_kn, 3) if total_kn > 0 else 0.5
        except Exception: scores["knowledge_hit_rate"] = 0.5
        try:
            sessions = self._session.list_sessions()
            if sessions:
                sessions_with_tools = sum(1 for s in sessions if s.get("message_count", 0) > 2)
                scores["task_completion_rate"] = round(sessions_with_tools / len(sessions), 3)
            else: scores["task_completion_rate"] = 0.5
        except Exception: scores["task_completion_rate"] = 0.5
        index = round(scores["tool_success_rate"] * 0.25 + scores["user_satisfaction"] * 0.25 + scores["knowledge_hit_rate"] * 0.25 + scores["task_completion_rate"] * 0.25, 3)
        return {"index": index, "level": "A" if index >= 0.85 else "B" if index >= 0.7 else "C" if index >= 0.55 else "D", "scores": scores, "timestamp": datetime.now().isoformat()}

    def get_logs(self, limit: int = 20, source: str = None) -> List[Dict[str, Any]]:
        try:
            from backend.routers.logs import _load_logs
            logs = _load_logs()
        except Exception: logs = []
        if source: logs = [l for l in logs if l.get("source") == source]
        return logs[:limit]

    def get_config(self) -> Dict[str, Any]:
        try:
            from backend.config import get_config
            config = get_config()
        except Exception: config = {}
        sensitive = {"api_key", "token", "password", "secret"}
        return {k: "****" if any(s in k.lower() for s in sensitive) else v for k, v in config.items()}

    def update_config(self, **kwargs) -> Dict[str, Any]:
        import yaml
        from backend.config import get_hermes_home, reload_config
        hermes_home = get_hermes_home()
        config_path = hermes_home / "config.yaml"
        existing = {}
        if config_path.exists():
            try: existing = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            except Exception: pass
        existing.update(kwargs)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(yaml.dump(existing, allow_unicode=True, default_flow_style=False), encoding="utf-8")
        reload_config()
        return {"success": True, "updated_keys": list(kwargs.keys())}