# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 子 Agent API

提供子 Agent 的查询接口。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", summary="列出活跃的子 Agent")
async def list_agents() -> List[Dict[str, Any]]:
    """获取所有活跃的子 Agent 列表"""
    return hermes_service.list_agents()


@router.get("/{agent_id}", summary="获取子 Agent 状态")
async def get_agent(agent_id: str) -> Dict[str, Any]:
    """根据 ID 获取子 Agent 的详细状态信息"""
    agent = hermes_service.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} 不存在")
    return agent


@router.delete("/{agent_id}", summary="终止子 Agent")
async def terminate_agent(agent_id: str) -> Dict[str, Any]:
    """终止指定的子 Agent"""
    result = hermes_service.terminate_agent(agent_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "终止失败"))
    return result
