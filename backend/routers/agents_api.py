# -*- coding: utf-8 -*-
"""Agent 管理 API 路由"""

import logging
from fastapi import APIRouter

logger = logging.getLogger("hermes.api.agents")
router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/list")
async def list_agents():
    try:
        from backend.services.agent_analytics import agent_analytics
        return agent_analytics.get_all_agents_summary()
    except Exception as e:
        return {"total": 0, "active": 0, "agents": [], "error": str(e)}


@router.get("/profile/{agent_id}")
async def get_agent_profile(agent_id: str):
    try:
        from backend.services.agent_analytics import agent_analytics
        return agent_analytics.get_agent_profile(agent_id)
    except Exception as e:
        return {"error": str(e)}


@router.get("/leaderboard")
async def get_leaderboard():
    try:
        from backend.services.agent_analytics import agent_analytics
        return agent_analytics.get_agent_leaderboard()
    except Exception as e:
        return {"leaderboard": [], "error": str(e)}


@router.get("/roles")
async def get_available_roles():
    from backend.services.agent_identity import AGENT_ROLES
    return {"roles": {role: {"label": info["label"], "description": info["description"]} for role, info in AGENT_ROLES.items()}}