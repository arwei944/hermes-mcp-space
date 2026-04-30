# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - MCP 服务状态 API

提供 MCP（Model Context Protocol）服务的状态查询和控制接口。
"""

import os
from typing import Any, Dict, List

from fastapi import APIRouter, Query

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
async def discover_mcp_services(
    ports: str = Query(default="", description="自定义端口列表，逗号分隔"),
    custom_url: str = Query(default="", description="自定义 MCP URL 或 HF Space 链接"),
    hf_user: str = Query(default="", description="扫描指定 HF 用户的 Space"),
) -> Dict[str, Any]:
    """扫描可用 MCP 服务
    
    支持多种输入格式：
    - ports: 本地端口扫描
    - custom_url: 直接 URL 或 HF Space 链接 (https://huggingface.co/spaces/owner/name)
    - hf_user: 扫描指定用户的所有 HF Space
    """
    import asyncio
    import aiohttp
    import re
    
    discovered = []
    
    # ---- 辅助函数 ----
    async def try_mcp_url(session, url, source, name="", description="", timeout=10):
        """尝试连接 MCP 端点，支持多种路径"""
        mcp_paths = ["/mcp", "/sse", "/api/mcp"]
        for path in mcp_paths:
            full_url = url.rstrip("/") + path
            try:
                async with session.post(full_url, json={
                    "jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05", "capabilities": {},
                        "clientInfo": {"name": "hermes-discovery", "version": "1.0.0"},
                    },
                }, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if "result" in data:
                            server_info = data["result"].get("serverInfo", {})
                            return {
                                "name": name or server_info.get("name", ""),
                                "url": full_url,
                                "description": description or server_info.get("name", "MCP Service"),
                                "status": "available",
                                "source": source,
                                "mcp_path": path,
                            }
            except Exception:
                continue
        return None
    
    def parse_hf_space_url(url):
        """解析 HF Space URL，返回 (owner, space_name) 或 None"""
        # Pattern: https://huggingface.co/spaces/{owner}/{name}
        m = re.match(r'https?://huggingface\.co/spaces/([^/]+)/([^/]+)/?', url)
        if m:
            return m.group(1), m.group(2)
        # Pattern: https://{owner}-{name}.hf.space
        m = re.match(r'https?://([^-]+)-([^.]+)\.hf\.space', url)
        if m:
            return m.group(1), m.group(2)
        return None
    
    def hf_space_to_mcp_url(owner, name):
        """将 HF Space 信息转为可能的 MCP URL"""
        return f"https://{owner}-{name}.hf.space"
    
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
        
        # ---- 1. 本地端口扫描 ----
        default_ports = [3000, 3001, 3002, 3003, 3004, 3005, 4000, 5000, 8000, 8080]
        if ports:
            try:
                custom_ports = [int(p.strip()) for p in ports.split(",") if p.strip().isdigit()]
                scan_ports = list(set(default_ports + custom_ports))
            except Exception:
                scan_ports = default_ports
        else:
            scan_ports = default_ports
        
        for port in scan_ports:
            result = await try_mcp_url(session, f"http://localhost:{port}", "localhost", timeout=2)
            if result:
                result["port"] = port
                discovered.append(result)
        
        # ---- 2. 自定义 URL / HF Space 链接 ----
        if custom_url:
            parsed = parse_hf_space_url(custom_url)
            if parsed:
                owner, name = parsed
                base_url = hf_space_to_mcp_url(owner, name)
                result = await try_mcp_url(
                    session, base_url, "huggingface",
                    name=name, description=f"{owner}/{name}",
                    timeout=15,
                )
                if result:
                    result["space_id"] = f"{owner}/{name}"
                    discovered.append(result)
                else:
                    discovered.append({
                        "name": name, "url": base_url + "/mcp",
                        "description": f"{owner}/{name} - 无法连接（可能处于休眠状态，请稍后重试）",
                        "status": "error", "source": "huggingface",
                        "space_id": f"{owner}/{name}",
                    })
            else:
                # 直接作为 MCP URL 探测
                result = await try_mcp_url(session, custom_url, "custom", timeout=10)
                if result:
                    discovered.append(result)
                else:
                    discovered.append({
                        "name": "custom-service", "url": custom_url,
                        "description": f"连接失败",
                        "status": "error", "source": "custom",
                    })
        
        # ---- 3. 指定用户 HF Space 扫描 ----
        scan_owner = hf_user or os.environ.get("SPACE_AUTHOR_NAME", "")
        if scan_owner:
            try:
                api_url = f"https://huggingface.co/api/spaces?author={scan_owner}&limit=100"
                async with session.get(api_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        spaces = await resp.json()
                        space_name = os.environ.get("SPACE_ID", "")
                        for space in spaces:
                            space_id = space.get("id", "")
                            if space_id and space_id != f"{scan_owner}/{space_name}":
                                owner, sname = space_id.split("/", 1)
                                base_url = hf_space_to_mcp_url(owner, sname)
                                result = await try_mcp_url(
                                    session, base_url, "huggingface",
                                    name=sname,
                                    description=space.get("description", "")[:100] or space_id,
                                    timeout=15,
                                )
                                if result:
                                    result["space_id"] = space_id
                                    discovered.append(result)
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
