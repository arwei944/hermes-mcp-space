# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - MCP 服务状态 API

提供 MCP（Model Context Protocol）服务的状态查询和控制接口。
"""

import os
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


@router.get("/discover", summary="扫描可用 MCP 服务")
async def discover_mcp_services() -> Dict[str, Any]:
    """扫描 HF Space 内网中可用的 MCP 服务"""
    discovered = []
    
    # 尝试探测常见的 MCP 端口
    import asyncio
    import aiohttp
    
    common_ports = [3000, 3001, 3002, 3003, 3004, 3005, 4000, 5000, 8000, 8080]
    
    # 获取当前 Space 信息
    space_name = os.environ.get("SPACE_ID", "")
    space_owner = os.environ.get("SPACE_AUTHOR_NAME", "")
    
    # 探测 localhost 上的 MCP 服务
    for port in common_ports:
        try:
            url = f"http://localhost:{port}/mcp"
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2)) as session:
                async with session.post(url, json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "hermes-discovery", "version": "1.0.0"}
                    }
                }) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if "result" in data:
                            server_info = data["result"].get("serverInfo", {})
                            discovered.append({
                                "name": server_info.get("name", f"service-{port}"),
                                "url": url,
                                "port": port,
                                "description": server_info.get("name", "MCP Service"),
                                "status": "available",
                            })
        except Exception:
            pass
    
    # 探测同用户的其他 HF Space
    if space_owner:
        try:
            import aiohttp
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                # 获取用户 Space 列表
                api_url = f"https://huggingface.co/api/spaces?author={space_owner}&limit=50"
                async with session.get(api_url) as resp:
                    if resp.status == 200:
                        spaces = await resp.json()
                        for space in spaces:
                            space_id = space.get("id", "")
                            if space_id and space_id != f"{space_owner}/{space_name}":
                                # 尝试探测该 Space 的 MCP 端点
                                space_url = f"https://{space_id.replace('/', '-')}.hf.space/mcp"
                                try:
                                    async with session.post(space_url, json={
                                        "jsonrpc": "2.0",
                                        "id": 1,
                                        "method": "initialize",
                                        "params": {
                                            "protocolVersion": "2024-11-05",
                                            "capabilities": {},
                                            "clientInfo": {"name": "hermes-discovery", "version": "1.0.0"}
                                        }
                                    }, timeout=aiohttp.ClientTimeout(total=3)) as mcp_resp:
                                        if mcp_resp.status == 200:
                                            mcp_data = await mcp_resp.json()
                                            if "result" in mcp_data:
                                                server_info = mcp_data["result"].get("serverInfo", {})
                                                discovered.append({
                                                    "name": server_info.get("name", space_id.split("/")[-1]),
                                                    "url": space_url,
                                                    "source": "huggingface",
                                                    "space_id": space_id,
                                                    "description": space.get("description", "")[:100] or server_info.get("name", "MCP Service"),
                                                    "status": "available",
                                                })
                                except Exception:
                                    pass
        except Exception:
            pass
    
    return {"discovered": discovered, "total": len(discovered)}


@router.post("/discover/add", summary="批量添加发现的 MCP 服务")
async def add_discovered_services(body: Dict[str, Any]) -> Dict[str, Any]:
    """批量添加扫描到的 MCP 服务"""
    from backend.services.mcp_client_service import mcp_client_service
    
    servers = body.get("servers", [])
    results = []
    
    for server in servers:
        try:
            name = server.get("name", "")
            url = server.get("url", "")
            prefix = server.get("prefix", "")
            result = mcp_client_service.add_server(name, url, prefix)
            results.append({"name": name, "success": True, "detail": result})
        except Exception as e:
            results.append({"name": server.get("name", ""), "success": False, "detail": str(e)})
    
    success_count = sum(1 for r in results if r["success"])
    return {"added": success_count, "total": len(results), "results": results}


@router.get("/servers/health", summary="获取所有外部 MCP 服务健康状态")
async def get_servers_health() -> List[Dict[str, Any]]:
    """对每个外部 MCP 服务执行健康检查"""
    from backend.services.mcp_client_service import mcp_client_service
    
    servers = mcp_client_service.list_servers()
    health_results = []
    
    import aiohttp
    
    for server in servers:
        url = server.get("url", "")
        name = server.get("name", "")
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3)) as session:
                async with session.post(url, json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "ping",
                    "params": {}
                }) as resp:
                    health_results.append({
                        "name": name,
                        "url": url,
                        "status": "healthy" if resp.status == 200 else "unhealthy",
                        "response_time_ms": 0,
                    })
        except Exception:
            health_results.append({
                "name": name,
                "url": url,
                "status": "unhealthy",
                "error": "connection_failed",
            })
    
    return health_results
