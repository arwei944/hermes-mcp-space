# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 工具管理 API

提供工具和工具集的查询接口。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from backend.services.hermes_service import hermes_service

router = APIRouter(tags=["tools"])


@router.get("/api/tools", summary="列出所有可用工具")
async def list_tools() -> List[Dict[str, Any]]:
    """获取所有可用工具列表，包含名称、描述、schema 和状态"""
    return hermes_service.list_tools()


@router.get("/api/tools/{tool_name}", summary="获取工具详情")
async def get_tool(tool_name: str) -> Dict[str, Any]:
    """根据名称获取工具的详细信息"""
    tool = hermes_service.get_tool(tool_name)
    if not tool:
        raise HTTPException(status_code=404, detail=f"工具 {tool_name} 不存在")
    return tool


@router.get("/api/toolsets", summary="列出所有工具集")
async def list_toolsets() -> List[Dict[str, Any]]:
    """获取所有工具集列表"""
    return hermes_service.list_toolsets()


@router.put("/api/tools/{tool_name}", summary="切换工具启用/禁用")
async def toggle_tool(tool_name: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """启用或禁用指定工具"""
    enabled = body.get("enabled", True)
    result = hermes_service.toggle_tool(tool_name, enabled)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "操作失败"))
    return result
