# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - MCP 服务状态 API

提供 MCP（Model Context Protocol）服务的状态查询和控制接口。
"""

from typing import Any, Dict, List

from fastapi import APIRouter

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/status", summary="获取 MCP 服务状态")
async def get_mcp_status() -> Dict[str, Any]:
    """
    获取 MCP 服务的当前状态

    Returns:
        包含服务状态、端口和已连接服务器信息的字典
    """
    return hermes_service.get_mcp_status()


@router.get("/tools", summary="获取 MCP 暴露的工具列表")
async def get_mcp_tools() -> List[Dict[str, Any]]:
    """获取通过 MCP 协议暴露给外部使用的工具列表"""
    return hermes_service.get_mcp_tools()


@router.post("/restart", summary="重启 MCP 服务")
async def restart_mcp() -> Dict[str, Any]:
    """重启 MCP 服务，使配置更改生效"""
    return hermes_service.restart_mcp()
