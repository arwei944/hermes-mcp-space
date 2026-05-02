# -*- coding: utf-8 -*-
"""
AnalyticsService — 分析统计服务 (v9)

负责：
- 会话分析概览 / 趋势 / 分布
- 工具调用统计
- Agent 行为画像
- 系统状态 / 仪表盘摘要
- 操作日志 / 配置管理
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from backend.config import get_hermes_home

logger = logging.getLogger("hermes-mcp")


class AnalyticsService:
    """分析统计服务"""

    def __init__(self, session_service):
        """
        Args:
            session_service: SessionService 实例，用于调用 list_sessions() 和 _load_messages()
        """
        self._session = session_service

    # ==================== Hermes 可用性检测 ====================

    @property
    def hermes_available(self) -> bool:
        """检测 Hermes Agent 是否可用（本地模块或远程 API）"""
        if not hasattr(self, '_hermes_available') or self._hermes_available is None:
            import os
            remote_url = os.environ.get("HERMES_API_URL", "").rstrip("/")
            if remote_url:
                self._hermes_available = True
            else:
                try:
                    import hermes  # type: ignore
                    self._hermes_available = True
                except ImportError:
                    self._hermes_available = False
        return self._hermes_available

    # ==================== 分析统计 ====================

    def get_analytics_overview(self) -> Dict[str, Any]:
        """会话分析概览"""
        sessions = self._session.list_sessions()
        messages_data = self._session._load_messages()
        messages = messages_data.get("messages", {})

        total_sessions = len(sessions)
        total_messages = sum(len(msgs) for msgs in messages.values())

        # Active sessions
        active = sum(1 for s in sessions if s.get("status") == "active")

        # Today stats
        today = datetime.now().strftime("%Y-%m-%d")
        today_sessions = len([s for s in sessions if str(s.get("created_at", "")).startswith(today)])

        # Average messages per session
        avg_messages = round(total_messages / total_sessions, 1) if total_sessions > 0 else 0

        # Total tags
        all_tags = set()
        for s in sessions:
            all_tags.update(s.get("tags", []))

        # Pinned/archived counts
        pinned = sum(1 for s in sessions if s.get("pinned", False))
        archived = sum(1 for s in sessions if s.get("archived", False))

        # Models used
        models = {}
        for s in sessions:
            model = s.get("model", "unknown")
            models[model] = models.get(model, 0) + 1

        return {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "active_sessions": active,
            "today_sessions": today_sessions,
            "avg_messages_per_session": avg_messages,
            "total_tags": len(all_tags),
            "pinned_sessions": pinned,
            "archived_sessions": archived,
            "models_used": models,
        }

    def get_analytics_trends(self, period: str = "daily", days: int = 30) -> Dict[str, Any]:
        """获取会话趋势数据"""
        sessions = self._session.list_sessions()

        # Build date buckets
        now = datetime.now()
        trends = []

        if period == "daily":
            for i in range(days - 1, -1, -1):
                date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
                count = len([s for s in sessions if str(s.get("created_at", ""))[:10] == date])
                trends.append({"date": date, "count": count})
        elif period == "weekly":
            weeks = days // 7
            for i in range(weeks - 1, -1, -1):
                week_start = (now - timedelta(weeks=i * 7)).strftime("%Y-%m-%d")
                week_end = (now - timedelta(weeks=(i - 1) * 7)).strftime("%Y-%m-%d")
                count = len([s for s in sessions if week_start <= str(s.get("created_at", ""))[:10] <= week_end])
                trends.append({"date": week_start, "count": count})
        elif period == "monthly":
            for i in range(11, -1, -1):
                month = (now - timedelta(days=i * 30)).strftime("%Y-%m")
                count = len([s for s in sessions if str(s.get("created_at", ""))[:7] == month])
                trends.append({"date": month, "count": count})

        return {"period": period, "days": days, "trends": trends}

    def get_analytics_distribution(self) -> Dict[str, Any]:
        """获取会话分布数据"""
        sessions = self._session.list_sessions()

        # By model
        model_dist = {}
        for s in sessions:
            model = s.get("model", "unknown")
            model_dist[model] = model_dist.get(model, 0) + 1

        # By source
        source_dist = {}
        for s in sessions:
            source = s.get("source", "unknown")
            source_dist[source] = source_dist.get(source, 0) + 1

        # By tags
        tag_dist = {}
        for s in sessions:
            for tag in s.get("tags", []):
                tag_dist[tag] = tag_dist.get(tag, 0) + 1

        # By hour (creation time)
        hour_dist = {str(h): 0 for h in range(24)}
        for s in sessions:
            ts = s.get("created_at", "")
            if len(ts) >= 13 and "T" in ts:
                try:
                    hour = int(ts.split("T")[1][:2])
                    hour_dist[str(hour)] = hour_dist.get(str(hour), 0) + 1
                except (ValueError, IndexError):
                    pass

        # By status
        status_dist = {}
        for s in sessions:
            status = s.get("status", "unknown")
            status_dist[status] = status_dist.get(status, 0) + 1

        return {
            "by_model": model_dist,
            "by_source": source_dist,
            "by_tag": tag_dist,
            "by_hour": hour_dist,
            "by_status": status_dist,
        }

    def get_analytics_tools(self, days: int = 7) -> Dict[str, Any]:
        """获取工具调用统计数据（从操作日志中提取）"""
        logs_path = get_hermes_home() / "data" / "logs.json"
        if not logs_path.exists():
            return {"tools": [], "period_days": days, "total_calls": 0}

        try:
            logs = json.loads(logs_path.read_text(encoding="utf-8"))
        except Exception:
            return {"tools": [], "period_days": days, "total_calls": 0}

        # Filter recent logs
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        recent = [l for l in logs if l.get("timestamp", "") >= cutoff]

        # Count tool-related actions
        tool_counts = {}
        for log in recent:
            action = log.get("action", "")
            detail = log.get("detail", "")
            # Extract tool name from detail like "POST /api/sessions/xxx/messages"
            if "tool" in action.lower() or "mcp" in detail.lower():
                tool_name = action
                tool_counts[tool_name] = tool_counts.get(tool_name, 0) + 1

        # Sort by count
        sorted_tools = sorted(tool_counts.items(), key=lambda x: -x[1])
        tools = [{"name": name, "count": count} for name, count in sorted_tools[:20]]

        return {
            "tools": tools,
            "period_days": days,
            "total_calls": sum(tool_counts.values()),
            "total_logs": len(recent),
        }

    def get_analytics_behavior(self) -> Dict[str, Any]:
        """获取 Agent 行为画像"""
        sessions = self._session.list_sessions()
        messages_data = self._session._load_messages()
        messages = messages_data.get("messages", {})

        # Message role distribution
        role_counts = {"user": 0, "assistant": 0, "system": 0}
        total_content_length = {"user": 0, "assistant": 0, "system": 0}

        for sid, msgs in messages.items():
            for m in msgs:
                role = m.get("role", "unknown")
                role_counts[role] = role_counts.get(role, 0) + 1
                content = m.get("content", "")
                total_content_length[role] = total_content_length.get(role, 0) + len(content)

        # Average response length
        avg_response = round(total_content_length.get("assistant", 0) / max(role_counts.get("assistant", 1), 1), 0)
        avg_user = round(total_content_length.get("user", 0) / max(role_counts.get("user", 1), 1), 0)

        # Most active model
        model_counts = {}
        for s in sessions:
            model = s.get("model", "unknown")
            model_counts[model] = model_counts.get(model, 0) + 1
        top_model = max(model_counts.items(), key=lambda x: x[1])[0] if model_counts else "unknown"

        # Sessions with summaries
        with_summary = sum(1 for s in sessions if s.get("summary"))

        return {
            "message_distribution": role_counts,
            "avg_response_length": avg_response,
            "avg_user_message_length": avg_user,
            "top_model": top_model,
            "sessions_with_summary": with_summary,
            "total_sessions": len(sessions),
            "total_messages": sum(role_counts.values()),
            "total_content_chars": sum(total_content_length.values()),
        }

    # ==================== 系统状态 ====================

    def get_system_status(self) -> Dict[str, Any]:
        """获取系统状态信息"""
        return {
            "status": "running",
            "message": "MCP 服务运行中",
            "port": 7860,
            "endpoint": "/mcp",
            "protocol": "Streamable HTTP + SSE",
            "servers": [],
            "hermes_available": self.hermes_available,
        }

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """获取仪表盘摘要数据"""
        sessions = self._session.list_sessions()
        active = [s for s in sessions if s.get("status") == "active"]
        overview = self.get_analytics_overview()
        return {
            "total_sessions": len(sessions),
            "active_sessions": len(active),
            "total_messages": overview.get("total_messages", 0),
            "today_sessions": overview.get("today_sessions", 0),
            "models_used": overview.get("models_used", {}),
        }

    # ==================== 操作日志 ====================

    def get_logs(self, limit: int = 20, source: str = None) -> List[Dict[str, Any]]:
        """获取操作日志"""
        try:
            from backend.routers.logs import _load_logs
            logs = _load_logs()
        except Exception:
            logs = []

        if source:
            logs = [l for l in logs if l.get("source") == source]
        return logs[:limit]

    # ==================== 配置管理 ====================

    def get_config(self) -> Dict[str, Any]:
        """获取当前系统配置（脱敏）"""
        try:
            from backend.config import get_config
            config = get_config()
        except Exception:
            config = {}

        # 脱敏
        sensitive = {"api_key", "token", "password", "secret"}
        safe = {}
        for k, v in config.items():
            if any(s in k.lower() for s in sensitive):
                safe[k] = "****"
            else:
                safe[k] = v
        return safe

    def update_config(self, **kwargs) -> Dict[str, Any]:
        """更新系统配置"""
        import yaml
        from backend.config import get_hermes_home, reload_config

        hermes_home = get_hermes_home()
        config_path = hermes_home / "config.yaml"
        existing = {}
        if config_path.exists():
            try:
                existing = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            except Exception:
                pass
        existing.update(kwargs)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(
            yaml.dump(existing, allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
        reload_config()  # 清除缓存，使 get_config 读取最新配置
        return {"success": True, "updated_keys": list(kwargs.keys())}
