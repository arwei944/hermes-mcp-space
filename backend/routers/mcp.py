# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - MCP 服务状态 API

提供 MCP（Model Context Protocol）服务的状态查询和控制接口。
"""

from typing import Any, Dict, List

from fastapi import APIRouter

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("", summary="获取 MCP 服务状态")
async def get_mcp_status_root() -> Dict[str, Any]:
    return hermes_service.get_mcp_status()


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


# ---- 外部 MCP 服务器管理 API ----

@router.get("/servers", summary="列出外部 MCP 服务器")
async def list_mcp_servers() -> List[Dict[str, Any]]:
    """列出所有已连接的外部 MCP 服务器"""
    from backend.services.mcp_client_service import mcp_client_service
    return mcp_client_service.list_servers()


@router.post("/servers", summary="添加外部 MCP 服务器")
async def add_mcp_server(name: str, url: str, prefix: str = "") -> Dict[str, Any]:
    """添加外部 MCP 服务器并自动发现工具"""
    from backend.services.mcp_client_service import mcp_client_service
    return mcp_client_service.add_server(name, url, prefix)


@router.delete("/servers/{server_name}", summary="移除外部 MCP 服务器")
async def remove_mcp_server(server_name: str) -> Dict[str, Any]:
    """移除外部 MCP 服务器"""
    from backend.services.mcp_client_service import mcp_client_service
    return mcp_client_service.remove_server(server_name)


@router.post("/servers/{server_name}/refresh", summary="刷新外部 MCP 服务器工具")
async def refresh_mcp_server(server_name: str) -> Dict[str, Any]:
    """刷新单个外部 MCP 服务器的工具列表"""
    from backend.services.mcp_client_service import mcp_client_service
    return mcp_client_service.refresh_server(server_name)


@router.post("/servers/refresh-all", summary="刷新所有外部 MCP 服务器")
async def refresh_all_mcp_servers() -> Dict[str, Any]:
    """刷新所有外部 MCP 服务器的工具列表"""
    from backend.services.mcp_client_service import mcp_client_service
    return mcp_client_service.refresh_all()
