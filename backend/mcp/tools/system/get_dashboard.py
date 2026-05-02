# -*- coding: utf-8 -*-
"""获取仪表盘摘要信息"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="get_dashboard_summary",
        description="获取仪表盘摘要信息",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """get_dashboard_summary handler"""
    try:
        from backend.services.hermes_service import hermes_service

        sessions = hermes_service.list_sessions()
        tools = hermes_service.list_tools()
        skills = hermes_service.list_skills()
        active = [s for s in sessions if s.get("status") == "active"]
        result = (
            f"仪表盘摘要:\n"
            f"- 总会话数: {len(sessions)}\n"
            f"- 活跃会话: {len(active)}\n"
            f"- 可用工具: {len(tools)}\n"
            f"- 技能数: {len(skills)}"
        )
        return success_response(result)
    except Exception as e:
        return error_response(f"获取仪表盘摘要失败: {e}")
