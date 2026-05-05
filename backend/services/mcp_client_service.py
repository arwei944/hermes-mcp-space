from backend.version import __version__
# -*- coding: utf-8 -*-
"""
MCP 客户端服务 - 连接外部 MCP 服务器，自动发现并注册工具
实现 MCP 网关能力：一个入口访问所有 MCP 服务

v15.5.4: 全面改为异步 aiohttp，修复自环死锁问题
"""

import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

import aiohttp

logger = logging.getLogger("hermes-mcp")


def _is_self_url(url: str) -> bool:
    """检测 URL 是否指向自己（避免自环死锁）"""
    space_host = os.environ.get("SPACE_HOST", "")
    space_id = os.environ.get("SPACE_ID", "")  # e.g. "arwei944/hermes-mcp-space"

    if not space_host and not space_id:
        return False

    # 匹配 https://{owner}-{name}.hf.space
    if space_host and space_host in url:
        return True

    # 匹配 HF Space ID
    if space_id:
        owner, name = space_id.split("/", 1)
        pattern = f"{owner}-{name}.hf.space"
        if pattern in url:
            return True

    # 匹配 localhost
    if "localhost" in url or "127.0.0.1" in url:
        return True

    return False


class MCPClientService:
    """MCP 客户端：管理外部 MCP 服务器连接（全异步）"""

    def __init__(self):
        self._servers: Dict[str, Dict[str, Any]] = {}  # name -> {url, tools, status, last_check}
        self._tools_cache: List[Dict[str, Any]] = []  # 聚合的外部工具列表
        self._config_path: Optional[Path] = None

    def init(self, config_path: Path):
        """初始化，加载已配置的外部服务器"""
        self._config_path = config_path
        config_path.parent.mkdir(parents=True, exist_ok=True)
        if config_path.exists():
            try:
                data = json.loads(config_path.read_text(encoding="utf-8"))
                for name, info in data.items():
                    self._servers[name] = {
                        "url": info.get("url", ""),
                        "tools": info.get("tools", []),
                        "status": "disconnected",
                        "last_check": None,
                        "prefix": info.get("prefix", f"mcp_{name}_"),
                    }
                logger.info(f"加载 {len(self._servers)} 个外部 MCP 服务器配置")
            except Exception as e:
                logger.warning(f"加载外部 MCP 配置失败: {e}")

    def _save_config(self):
        """保存配置到文件"""
        if not self._config_path:
            return
        data = {}
        for name, info in self._servers.items():
            data[name] = {
                "url": info["url"],
                "tools": info.get("tools", []),
                "prefix": info.get("prefix", f"mcp_{name}_"),
            }
        self._config_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    # ---- 同步接口（配置管理，不涉及网络 IO） ----

    def add_server_no_discover(self, name: str, url: str, prefix: str = "") -> Dict[str, Any]:
        """添加外部 MCP 服务器（不发现工具，用于批量添加场景）"""
        if not name or not url:
            return {"success": False, "message": "名称和 URL 不能为空"}
        if name in self._servers:
            return {"success": False, "message": f"服务器 '{name}' 已存在"}

        prefix = prefix or f"mcp_{name}_"
        self._servers[name] = {
            "url": url,
            "tools": [],
            "status": "pending",
            "last_check": None,
            "prefix": prefix,
        }
        self._save_config()
        self._rebuild_tools_cache()
        return {
            "success": True,
            "message": f"服务器 '{name}' 已添加（工具发现中）",
            "server": name,
            "tools_count": 0,
        }

    def remove_server(self, name: str) -> Dict[str, Any]:
        """移除外部 MCP 服务器"""
        if name not in self._servers:
            return {"success": False, "message": f"服务器 '{name}' 不存在"}

        del self._servers[name]
        self._save_config()
        self._rebuild_tools_cache()
        return {"success": True, "message": f"服务器 '{name}' 已移除"}

    def list_servers(self) -> List[Dict[str, Any]]:
        """列出所有外部 MCP 服务器"""
        result = []
        for name, info in self._servers.items():
            result.append({
                "name": name,
                "url": info["url"],
                "tools_count": len(info.get("tools", [])),
                "status": info.get("status", "unknown"),
                "prefix": info.get("prefix", ""),
                "last_check": info.get("last_check", ""),
            })
        return result

    def get_external_tools(self) -> List[Dict[str, Any]]:
        """获取所有外部工具（带前缀）"""
        if not self._tools_cache:
            self._rebuild_tools_cache()
        return self._tools_cache

    def is_external_tool(self, tool_name: str) -> bool:
        """判断工具是否是外部工具"""
        for name, info in self._servers.items():
            prefix = info.get("prefix", f"mcp_{name}_")
            if tool_name.startswith(prefix):
                return True
        return False

    # ---- 异步接口（涉及网络 IO，用 aiohttp） ----

    async def add_server(self, name: str, url: str, prefix: str = "") -> Dict[str, Any]:
        """添加外部 MCP 服务器并异步发现工具"""
        if not name or not url:
            return {"success": False, "message": "名称和 URL 不能为空"}
        if name in self._servers:
            return {"success": False, "message": f"服务器 '{name}' 已存在"}

        prefix = prefix or f"mcp_{name}_"
        self._servers[name] = {
            "url": url,
            "tools": [],
            "status": "disconnected",
            "last_check": None,
            "prefix": prefix,
        }
        self._save_config()

        # 自环检测：直接获取自身工具，无需网络请求
        if _is_self_url(url):
            try:
                from backend.services.hermes_service import hermes_service
                self_tools = hermes_service.get_mcp_tools()
                self._servers[name]["tools"] = self_tools
                self._servers[name]["status"] = "self_reference"
                self._servers[name]["last_check"] = datetime.now().isoformat()
                self._rebuild_tools_cache()
                logger.info(f"MCP 服务器 '{name}' 指向自身，已加载 {len(self_tools)} 个本地工具")
                return {
                    "success": True,
                    "message": f"服务器 '{name}' 已添加（自身服务，{len(self_tools)} 个工具）",
                    "server": name,
                    "tools_count": len(self_tools),
                }
            except Exception as e:
                self._servers[name]["status"] = "error"
                self._servers[name]["error"] = f"加载自身工具失败: {e}"
                self._servers[name]["last_check"] = datetime.now().isoformat()
                return {
                    "success": True,
                    "message": f"服务器 '{name}' 已添加，但加载工具失败: {e}",
                    "server": name,
                    "tools_count": 0,
                }

        # 异步发现工具
        tools_count = await self._discover_tools(name)
        return {
            "success": True,
            "message": f"服务器 '{name}' 已添加，发现 {tools_count} 个工具",
            "server": name,
            "tools_count": tools_count,
        }

    async def refresh_server(self, name: str) -> Dict[str, Any]:
        """刷新单个服务器的工具列表"""
        if name not in self._servers:
            return {"success": False, "message": f"服务器 '{name}' 不存在"}

        info = self._servers[name]
        if _is_self_url(info["url"]):
            # 自环：直接重新加载自身工具
            try:
                from backend.services.hermes_service import hermes_service
                self_tools = hermes_service.get_mcp_tools()
                info["tools"] = self_tools
                info["last_check"] = datetime.now().isoformat()
                self._rebuild_tools_cache()
                return {"success": True, "message": f"已刷新自身工具，{len(self_tools)} 个", "tools_count": len(self_tools)}
            except Exception as e:
                return {"success": False, "message": f"刷新自身工具失败: {e}", "tools_count": len(info.get("tools", []))}

        count = await self._discover_tools(name)
        return {"success": True, "message": f"刷新完成，{count} 个工具", "tools_count": count}

    async def refresh_all(self) -> Dict[str, Any]:
        """刷新所有服务器（并行）"""
        tasks = []
        names = []
        for name in list(self._servers.keys()):
            info = self._servers[name]
            if _is_self_url(info["url"]):
                continue
            tasks.append(self._discover_tools(name))
            names.append(name)

        if tasks:
            counts = await asyncio.gather(*tasks, return_exceptions=True)
            total = sum(c for c in counts if isinstance(c, int))
        else:
            total = 0

        return {"success": True, "message": f"已刷新 {len(names)} 个服务器，共 {total} 个工具"}

    async def call_external_tool(self, tool_name: str, arguments: dict) -> Any:
        """异步调用外部 MCP 服务器的工具"""
        for name, info in self._servers.items():
            prefix = info.get("prefix", f"mcp_{name}_")
            if tool_name.startswith(prefix):
                original_name = tool_name[len(prefix):]
                return await self._call_tool(info["url"], original_name, arguments)

        return {"error": f"未找到工具 '{tool_name}' 对应的外部服务器"}

    # ---- 内部异步方法 ----

    async def _discover_tools(self, server_name: str) -> int:
        """异步发现外部服务器的工具列表"""
        info = self._servers.get(server_name)
        if not info:
            return 0

        url = info["url"]
        try:
            tools = await self._fetch_tools(url)
            info["tools"] = tools
            info["status"] = "connected"
            info["last_check"] = datetime.now().isoformat()
            self._rebuild_tools_cache()
            logger.info(f"MCP 服务器 '{server_name}' 发现 {len(tools)} 个工具")
            return len(tools)
        except Exception as e:
            info["status"] = "error"
            info["last_check"] = datetime.now().isoformat()
            info["error"] = str(e)
            logger.warning(f"MCP 服务器 '{server_name}' 连接失败: {e}")
            return 0

    async def _mcp_request(
        self, session: aiohttp.ClientSession, url: str, payload: dict,
        session_id: str = "", timeout: int = 30
    ) -> dict:
        """异步发送 MCP JSON-RPC 请求"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if session_id:
            headers["Mcp-Session-Id"] = session_id

        async with session.post(
            url, json=payload, headers=headers,
            timeout=aiohttp.ClientTimeout(total=timeout)
        ) as resp:
            raw = await resp.text()
            # MCP Streamable HTTP 可能返回 SSE 格式
            if raw.startswith("event:"):
                for line in raw.split("\n"):
                    if line.startswith("data:"):
                        return json.loads(line[len("data:"):].strip())
            return json.loads(raw)

    async def _initialize_and_get_session(
        self, session: aiohttp.ClientSession, url: str
    ) -> str:
        """异步发送 initialize 并从响应头提取 mcp-session-id"""
        payload = {
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "hermes-mcp-space", "version": __version__},
            },
        }

        async with session.post(
            url, json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            timeout=aiohttp.ClientTimeout(total=15)
        ) as resp:
            await resp.read()  # consume body
            session_id = resp.headers.get("mcp-session-id", "")
            if not session_id:
                raise RuntimeError("MCP 服务器未返回 mcp-session-id")

        # 发送 initialized 通知
        try:
            await session.post(
                url,
                json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                    "Mcp-Session-Id": session_id,
                },
                timeout=aiohttp.ClientTimeout(total=5)
            )
        except Exception:
            pass  # 通知失败不影响后续操作

        logger.info(f"MCP session 已建立: {session_id[:12]}...")
        return session_id

    async def _fetch_tools(self, url: str) -> List[Dict[str, Any]]:
        """异步通过 MCP 协议获取工具列表"""
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Step 1: 初始化 session
            session_id = await self._initialize_and_get_session(session, url)

            # Step 2: 带 session ID 请求 tools/list
            result = await self._mcp_request(session, url, {
                "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {},
            }, session_id=session_id)

            return result.get("result", {}).get("tools", [])

    async def _call_tool(self, url: str, tool_name: str, arguments: dict) -> Any:
        """异步通过 MCP 协议调用工具"""
        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            session_id = await self._initialize_and_get_session(session, url)

            result = await self._mcp_request(session, url, {
                "jsonrpc": "2.0", "id": 2, "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            }, session_id=session_id, timeout=60)

            return result

    def _rebuild_tools_cache(self):
        """重建外部工具缓存（带前缀）"""
        self._tools_cache = []
        for name, info in self._servers.items():
            prefix = info.get("prefix", f"mcp_{name}_")
            for tool in info.get("tools", []):
                external_tool = {
                    "name": f"{prefix}{tool['name']}",
                    "description": f"[{name}] {tool.get('description', '')}",
                    "inputSchema": tool.get("inputSchema", {"type": "object", "properties": {}}),
                    "_server": name,
                    "_original_name": tool["name"],
                }
                self._tools_cache.append(external_tool)


# 全局单例
mcp_client_service = MCPClientService()
