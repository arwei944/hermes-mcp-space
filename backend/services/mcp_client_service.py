from backend.version import __version__
# -*- coding: utf-8 -*-
"""
MCP 客户端服务 - 连接外部 MCP 服务器，自动发现并注册工具
实现 MCP 网关能力：一个入口访问所有 MCP 服务
"""

import json
import logging
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger("hermes-mcp")


class MCPClientService:
    """MCP 客户端：管理外部 MCP 服务器连接"""

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

    def add_server(self, name: str, url: str, prefix: str = "") -> Dict[str, Any]:
        """添加外部 MCP 服务器"""
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

        # 自动发现工具
        tools_count = self._discover_tools(name)
        return {
            "success": True,
            "message": f"服务器 '{name}' 已添加，发现 {tools_count} 个工具",
            "server": name,
            "tools_count": tools_count,
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

    def refresh_server(self, name: str) -> Dict[str, Any]:
        """刷新单个服务器的工具列表"""
        if name not in self._servers:
            return {"success": False, "message": f"服务器 '{name}' 不存在"}
        count = self._discover_tools(name)
        return {"success": True, "message": f"刷新完成，{count} 个工具", "tools_count": count}

    def refresh_all(self) -> Dict[str, Any]:
        """刷新所有服务器"""
        total = 0
        for name in list(self._servers.keys()):
            total += self._discover_tools(name)
        return {"success": True, "message": f"已刷新 {len(self._servers)} 个服务器，共 {total} 个工具"}

    def get_external_tools(self) -> List[Dict[str, Any]]:
        """获取所有外部工具（带前缀）"""
        if not self._tools_cache:
            self._rebuild_tools_cache()
        return self._tools_cache

    def call_external_tool(self, tool_name: str, arguments: dict) -> Any:
        """调用外部 MCP 服务器的工具"""
        # 找到工具所属的服务器
        for name, info in self._servers.items():
            prefix = info.get("prefix", f"mcp_{name}_")
            if tool_name.startswith(prefix):
                original_name = tool_name[len(prefix):]
                return self._call_tool(info["url"], original_name, arguments)

        return {"error": f"未找到工具 '{tool_name}' 对应的外部服务器"}

    def is_external_tool(self, tool_name: str) -> bool:
        """判断工具是否是外部工具"""
        for name, info in self._servers.items():
            prefix = info.get("prefix", f"mcp_{name}_")
            if tool_name.startswith(prefix):
                return True
        return False

    def _discover_tools(self, server_name: str) -> int:
        """发现外部服务器的工具列表"""
        info = self._servers.get(server_name)
        if not info:
            return 0

        url = info["url"]
        try:
            tools = self._fetch_tools(url)
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

    def _mcp_request(self, url: str, payload: dict, session_id: str = "", timeout: int = 15) -> dict:
        """发送 MCP JSON-RPC 请求，自动处理 SSE 响应格式"""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if session_id:
            headers["Mcp-Session-Id"] = session_id

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            # MCP Streamable HTTP 可能返回 SSE 格式: "event: message\ndata: {...}\n\n"
            # 也可能直接返回 JSON
            if raw.startswith("event:"):
                for line in raw.split("\n"):
                    if line.startswith("data:"):
                        return json.loads(line[len("data:"):].strip())
            return json.loads(raw)

    def _initialize_and_get_session(self, url: str) -> str:
        """低层: 发送 initialize 并从响应头提取 mcp-session-id"""
        payload = json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "hermes-mcp-space", "version": __version__},
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            url, data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()  # consume body
            session_id = resp.headers.get("mcp-session-id", "")
            if not session_id:
                raise RuntimeError("MCP 服务器未返回 mcp-session-id")

        # Step 2: 发送 initialized 通知（不需要响应）
        try:
            notif_payload = json.dumps({
                "jsonrpc": "2.0", "method": "notifications/initialized",
            }).encode("utf-8")
            notif_req = urllib.request.Request(
                url, data=notif_payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                    "Mcp-Session-Id": session_id,
                },
                method="POST",
            )
            urllib.request.urlopen(notif_req, timeout=5)
        except Exception:
            pass  # 通知失败不影响后续操作

        logger.info(f"MCP session 已建立: {session_id[:12]}...")
        return session_id

    def _fetch_tools(self, url: str) -> List[Dict[str, Any]]:
        """通过 MCP 协议获取工具列表（含 session 管理）"""
        # Step 1: 初始化 session
        session_id = self._initialize_and_get_session(url)

        # Step 2: 带 session ID 请求 tools/list
        result = self._mcp_request(url, {
            "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {},
        }, session_id=session_id)

        return result.get("result", {}).get("tools", [])

    def _call_tool(self, url: str, tool_name: str, arguments: dict) -> Any:
        """通过 MCP 协议调用工具（含 session 管理）"""
        # 每次调用都重新建立 session（无状态，简单可靠）
        session_id = self._initialize_and_get_session(url)

        result = self._mcp_request(url, {
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
