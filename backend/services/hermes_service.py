# -*- coding: utf-8 -*-
"""
HermesService — Facade 门面模式 (v9)
向后兼容：外部调用方式不变，内部委托给专职服务
"""
import logging
from typing import Any, Dict, List, Optional

from backend.services.session_service import SessionService
from backend.services.skill_service import SkillService
from backend.services.memory_service import MemoryService
from backend.services.cron_service import CronService
from backend.services.analytics_service import AnalyticsService
from backend.services.agent_service import AgentService
from backend.services.tool_service import ToolService

logger = logging.getLogger("hermes-mcp")


class HermesService:
    """HermesService Facade — 向后兼容层

    所有方法签名与原始实现完全一致，内部委托给专职服务。
    外部代码（mcp_server.py / routers / 前端）无需任何修改。
    """

    def __init__(self):
        self._session = SessionService()
        self._skill = SkillService()
        self._memory = MemoryService()
        self._cron = CronService()
        self._analytics = AnalyticsService(session_service=self._session)
        self._agent = AgentService()
        self._tool = ToolService()

    # ==================== 属性 ====================

    @property
    def hermes_available(self) -> bool:
        return self._analytics.hermes_available

    # ==================== Session 委托 ====================

    def _optimize_database(self):
        return self._session._optimize_database()

    def _get_session_db_path(self):
        return self._session._get_session_db_path()

    def _query_session_db(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        return self._session._query_session_db(sql, params)

    def _get_sessions_path(self):
        return self._session._get_sessions_path()

    def _load_sessions_data(self) -> Dict[str, Any]:
        return self._session._load_sessions_data()

    def _save_sessions_data(self, data: Dict[str, Any]) -> bool:
        return self._session._save_sessions_data(data)

    def _load_messages(self) -> Dict[str, Any]:
        return self._session._load_messages()

    def list_sessions(self) -> List[Dict[str, Any]]:
        return self._session.list_sessions()

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._session.get_session(session_id)

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        return self._session.get_session_messages(session_id)

    def create_session(self, title: str = "", model: str = "", source: str = "mcp") -> Dict[str, Any]:
        return self._session.create_session(title=title, model=model, source=source)

    def add_session_message(self, session_id: str, role: str, content: str, metadata: dict = None) -> Dict[str, Any]:
        return self._session.add_session_message(session_id, role, content, metadata)

    def delete_session(self, session_id: str) -> Dict[str, Any]:
        return self._session.delete_session(session_id)

    def compress_session(self, session_id: str) -> Dict[str, Any]:
        return self._session.compress_session(session_id)

    def _highlight_matches(self, text: str, query: str) -> str:
        return self._session._highlight_matches(text, query)

    def _enhance_search_query(self, query: str) -> str:
        return self._session._enhance_search_query(query)

    def search_sessions(self, keyword: str, limit: int = 20) -> List[Dict[str, Any]]:
        return self._session.search_sessions(keyword, limit)

    def get_search_suggestions(self, query: str, limit: int = 10) -> list:
        return self._session.get_search_suggestions(query, limit)

    def get_all_tags(self) -> List[Dict[str, Any]]:
        return self._session.get_all_tags()

    def update_session_field(self, session_id: str, **fields: Any) -> Dict[str, Any]:
        return self._session.update_session_field(session_id, **fields)

    def export_session_markdown(self, session_id: str) -> str:
        return self._session.export_session_markdown(session_id)

    def export_session_csv(self, session_id: str) -> str:
        return self._session.export_session_csv(session_id)

    def search_messages(self, query: str, session_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
        return self._session.search_messages(query, session_id, limit)

    # ==================== Skill 委托 ====================

    def list_skills(self, available_tools: list = None) -> List[Dict[str, Any]]:
        return self._skill.list_skills(available_tools)

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        return self._skill.get_skill(name)

    def create_skill(self, name: str, content: str = "", description: str = "", tags: list = None) -> Dict[str, Any]:
        return self._skill.create_skill(name, content, description, tags)

    def update_skill(self, name: str, content: str = "", description: str = "", tags: list = None) -> Dict[str, Any]:
        return self._skill.update_skill(name, content, description, tags)

    def delete_skill(self, name: str) -> Dict[str, Any]:
        return self._skill.delete_skill(name)

    def _read_skill_meta(self, name: str) -> dict:
        return self._skill._read_skill_meta(name)

    def _read_skill_description(self, skill_md) -> str:
        return self._skill._read_skill_description(skill_md)

    # ==================== Memory 委托 ====================

    def read_memory(self) -> Dict[str, str]:
        return self._memory.read_memory()

    def update_memory(self, memory: Optional[str] = None, user: Optional[str] = None) -> Dict[str, Any]:
        return self._memory.update_memory(memory, user)

    # ==================== Cron 委托 ====================

    def _get_jobs_path(self):
        return self._cron._get_jobs_path()

    def _load_jobs(self) -> List[Dict[str, Any]]:
        return self._cron._load_jobs()

    def _save_jobs(self, jobs: List[Dict[str, Any]]) -> bool:
        return self._cron._save_jobs(jobs)

    def list_cron_jobs(self) -> List[Dict[str, Any]]:
        return self._cron.list_cron_jobs()

    def get_cron_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self._cron.get_cron_job(job_id)

    def create_cron_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        return self._cron.create_cron_job(job)

    def update_cron_job(self, job_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        return self._cron.update_cron_job(job_id, updates)

    def delete_cron_job(self, job_id: str) -> Dict[str, Any]:
        return self._cron.delete_cron_job(job_id)

    def get_cron_job_output(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self._cron.get_cron_job_output(job_id)

    def trigger_cron_job(self, job_id: str) -> Dict[str, Any]:
        return self._cron.trigger_cron_job(job_id)

    # ==================== Analytics 委托 ====================

    def get_analytics_overview(self) -> Dict[str, Any]:
        return self._analytics.get_analytics_overview()

    def get_analytics_trends(self, period: str = "daily", days: int = 30) -> Dict[str, Any]:
        return self._analytics.get_analytics_trends(period, days)

    def get_analytics_distribution(self) -> Dict[str, Any]:
        return self._analytics.get_analytics_distribution()

    def get_analytics_tools(self, days: int = 7) -> Dict[str, Any]:
        return self._analytics.get_analytics_tools(days)

    def get_analytics_behavior(self) -> Dict[str, Any]:
        return self._analytics.get_analytics_behavior()

    def get_system_status(self) -> Dict[str, Any]:
        return self._analytics.get_system_status()

    def get_dashboard_summary(self) -> Dict[str, Any]:
        return self._analytics.get_dashboard_summary()

    def get_logs(self, limit: int = 20, source: str = None) -> List[Dict[str, Any]]:
        return self._analytics.get_logs(limit, source)

    def get_config(self) -> Dict[str, Any]:
        return self._analytics.get_config()

    def update_config(self, **kwargs) -> Dict[str, Any]:
        return self._analytics.update_config(**kwargs)

    # ==================== Agent 委托 ====================

    def list_agents(self) -> List[Dict[str, Any]]:
        return self._agent.list_agents()

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        return self._agent.get_agent(agent_id)

    def terminate_agent(self, agent_id: str) -> Dict[str, Any]:
        return self._agent.terminate_agent(agent_id)

    # ==================== Tool 委托 ====================

    def list_tools(self) -> List[Dict[str, Any]]:
        return self._tool.list_tools()

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        return self._tool.get_tool(name)

    def toggle_tool(self, name: str, enabled: bool = True) -> Dict[str, Any]:
        return self._tool.toggle_tool(name, enabled)

    def list_toolsets(self) -> List[Dict[str, Any]]:
        return self._tool.list_toolsets()

    def _get_demo_tools(self) -> List[Dict[str, Any]]:
        return self._tool._get_demo_tools()

    def get_mcp_status(self) -> Dict[str, Any]:
        return self._tool.get_mcp_status()

    def get_mcp_tools(self) -> List[Dict[str, Any]]:
        return self._tool.get_mcp_tools()

    def restart_mcp(self) -> Dict[str, Any]:
        return self._tool.restart_mcp()

    # ==================== 知识提取委托 (Analytics) ====================

    def generate_session_summary(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        return self._analytics.generate_session_summary(session, messages)

    def extract_key_info(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._analytics.extract_key_info(messages)

    def generate_skill_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        return self._analytics.generate_skill_from_messages(session, messages)

    def generate_knowledge_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        return self._analytics.generate_knowledge_from_messages(session, messages)

    def generate_learning_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        return self._analytics.generate_learning_from_messages(session, messages)


# 全局服务实例
hermes_service = HermesService()
