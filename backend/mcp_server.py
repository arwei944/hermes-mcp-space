# -*- coding: utf-8 -*-
"""
Hermes Agent - MCP Server (manual implementation)
手动实现 MCP Streamable HTTP 端点，不依赖 FastMCP.run()。
"""

import json
import logging
import os
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

logger = logging.getLogger("hermes-mcp")

router = APIRouter(tags=["mcp-protocol"])

# Session storage
_sessions: Dict[str, Dict] = {}


def _get_server_info():
    return {
        "name": "Hermes Agent",
        "version": os.environ.get("APP_VERSION", "1.0.0"),
    }


def _get_capabilities():
    return {
        "experimental": {},
        "prompts": {"listChanged": False},
        "resources": {"subscribe": False, "listChanged": False},
        "tools": {"listChanged": False},
    }


def _get_tools():
    """Return the list of available MCP tools."""
    return [
        {
            "name": "list_sessions",
            "description": "列出最近的会话列表",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 20, "description": "返回的最大会话数"}
                }
            }
        },
        {
            "name": "get_session_messages",
            "description": "获取指定会话的消息历史",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "会话 ID"},
                    "limit": {"type": "integer", "default": 50, "description": "返回的最大消息数"}
                },
                "required": ["session_id"]
            }
        },
        {
            "name": "list_tools",
            "description": "列出所有可用的工具及其状态",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "list_skills",
            "description": "列出所有可用的技能",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "get_skill_content",
            "description": "获取指定技能的详细内容",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "skill_name": {"type": "string", "description": "技能名称"}
                },
                "required": ["skill_name"]
            }
        },
        {
            "name": "read_memory",
            "description": "读取 Agent 的长期记忆（MEMORY.md）",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "read_user_profile",
            "description": "读取用户画像（USER.md）",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "write_memory",
            "description": "写入/更新 Agent 的长期记忆",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "要保存的记忆内容（Markdown 格式）"}
                },
                "required": ["content"]
            }
        },
        {
            "name": "get_system_status",
            "description": "获取 Hermes Agent 系统状态",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "get_dashboard_summary",
            "description": "获取仪表盘摘要信息",
            "inputSchema": {"type": "object", "properties": {}}
        },
    ]


def _get_resources():
    """Return the list of available MCP resources."""
    return [
        {
            "uri": "hermes://memory",
            "name": "Agent Memory",
            "description": "Agent 的长期记忆文件",
            "mimeType": "text/markdown"
        },
        {
            "uri": "hermes://user-profile",
            "name": "User Profile",
            "description": "用户画像文件",
            "mimeType": "text/markdown"
        },
        {
            "uri": "hermes://sessions",
            "name": "Sessions",
            "description": "会话列表",
            "mimeType": "application/json"
        },
        {
            "uri": "hermes://tools",
            "name": "Tools",
            "description": "工具列表",
            "mimeType": "application/json"
        },
    ]


async def _call_tool(name: str, arguments: Dict[str, Any]) -> str:
    """Execute a tool and return the result as text."""
    from backend.services.hermes_service import hermes_service

    if name == "list_sessions":
        sessions = hermes_service.list_sessions()
        limit = arguments.get("limit", 20)
        result = sessions[:limit]
        if not result:
            return "当前没有会话记录"
        lines = []
        for s in result:
            lines.append(
                f"- [{s.get('id', '?')}] {s.get('source', '?')} | "
                f"{s.get('model', '?')} | {s.get('status', '?')} | "
                f"{s.get('created_at', '?')}"
            )
        return f"共 {len(sessions)} 个会话:\n" + "\n".join(lines)

    elif name == "get_session_messages":
        messages = hermes_service.get_session_messages(arguments["session_id"])
        limit = arguments.get("limit", 50)
        result = messages[-limit:]
        if not result:
            return f"会话 {arguments['session_id']} 没有消息记录"
        lines = []
        for msg in result:
            role = msg.get("role", "?")
            content = str(msg.get("content", ""))[:200]
            lines.append(f"[{role}] {content}")
        return "\n".join(lines)

    elif name == "list_tools":
        tools = hermes_service.list_tools()
        if not tools:
            return "当前没有可用工具"
        lines = []
        for t in tools:
            status = "✅" if t.get("status") == "active" else "❌"
            lines.append(f"{status} {t.get('name', '?')}: {t.get('description', '无描述')}")
        return f"共 {len(tools)} 个工具:\n" + "\n".join(lines)

    elif name == "list_skills":
        skills = hermes_service.list_skills()
        if not skills:
            return "当前没有可用技能"
        lines = [f"- {s.get('name', '?')}: {s.get('description', '无描述')}" for s in skills]
        return f"共 {len(skills)} 个技能:\n" + "\n".join(lines)

    elif name == "get_skill_content":
        skill = hermes_service.get_skill(arguments["skill_name"])
        if skill is None:
            return f"技能 '{arguments['skill_name']}' 不存在"
        return skill.get("content", "")

    elif name == "read_memory":
        data = hermes_service.read_memory()
        return data.get("memory", "无记忆内容")

    elif name == "read_user_profile":
        data = hermes_service.read_memory()
        return data.get("user", "无用户画像")

    elif name == "write_memory":
        result = hermes_service.update_memory(memory=arguments["content"])
        return result.get("message", "操作完成")

    elif name == "get_system_status":
        status = hermes_service.get_mcp_status()
        return (
            f"Hermes Agent 系统状态:\n"
            f"- MCP 服务: {status.get('status', 'unknown')}\n"
            f"- Hermes 可用: {'是' if hermes_service.hermes_available else '否'}\n"
            f"- 版本: {os.environ.get('APP_VERSION', '1.0.0')}"
        )

    elif name == "get_dashboard_summary":
        sessions = hermes_service.list_sessions()
        tools = hermes_service.list_tools()
        skills = hermes_service.list_skills()
        active = [s for s in sessions if s.get("status") == "active"]
        return (
            f"仪表盘摘要:\n"
            f"- 总会话数: {len(sessions)}\n"
            f"- 活跃会话: {len(active)}\n"
            f"- 可用工具: {len(tools)}\n"
            f"- 技能数: {len(skills)}"
        )

    else:
        return f"未知工具: {name}"


async def _read_resource(uri: str) -> str:
    """Read a resource by URI."""
    from backend.services.hermes_service import hermes_service

    if uri == "hermes://memory":
        data = hermes_service.read_memory()
        return data.get("memory", "")
    elif uri == "hermes://user-profile":
        data = hermes_service.read_memory()
        return data.get("user", "")
    elif uri == "hermes://sessions":
        import json as _json
        return _json.dumps(hermes_service.list_sessions(), ensure_ascii=False, indent=2)
    elif uri == "hermes://tools":
        import json as _json
        return _json.dumps(hermes_service.list_tools(), ensure_ascii=False, indent=2)
    else:
        return f"未知资源: {uri}"


def _jsonrpc_response(id_val, result):
    return {"jsonrpc": "2.0", "id": id_val, "result": result}


def _jsonrpc_error(id_val, code, message):
    return {"jsonrpc": "2.0", "id": id_val, "error": {"code": code, "message": message}}


@router.post("/mcp")
async def mcp_endpoint(request: Request):
    """MCP Streamable HTTP endpoint - handles all JSON-RPC messages."""
    body = await request.json()

    jsonrpc = body.get("jsonrpc")
    method = body.get("method")
    params = body.get("params", {})
    req_id = body.get("id")

    if jsonrpc != "2.0":
        return JSONResponse(
            content=_jsonrpc_error(req_id, -32600, "Invalid Request: jsonrpc must be '2.0'"),
            status_code=400,
        )

    # Handle different MCP methods
    if method == "initialize":
        session_id = str(uuid.uuid4())
        _sessions[session_id] = {"initialized": True}
        response = _jsonrpc_response(req_id, {
            "protocolVersion": "2025-03-26",
            "capabilities": _get_capabilities(),
            "serverInfo": _get_server_info(),
        })
        resp = JSONResponse(content=response)
        resp.headers["Mcp-Session-Id"] = session_id
        return resp

    elif method == "notifications/initialized":
        return JSONResponse(content=None, status_code=202)

    elif method == "tools/list":
        return JSONResponse(content=_jsonrpc_response(req_id, {"tools": _get_tools()}))

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        try:
            result_text = await _call_tool(tool_name, arguments)
            return JSONResponse(content=_jsonrpc_response(req_id, {
                "content": [{"type": "text", "text": result_text}]
            }))
        except Exception as e:
            return JSONResponse(content=_jsonrpc_error(req_id, -32603, str(e)))

    elif method == "resources/list":
        return JSONResponse(content=_jsonrpc_response(req_id, {"resources": _get_resources()}))

    elif method == "resources/read":
        uri = params.get("uri", "")
        try:
            content = await _read_resource(uri)
            return JSONResponse(content=_jsonrpc_response(req_id, {
                "contents": [{"uri": uri, "mimeType": "text/plain", "text": content}]
            }))
        except Exception as e:
            return JSONResponse(content=_jsonrpc_error(req_id, -32603, str(e)))

    elif method == "ping":
        return JSONResponse(content=_jsonrpc_response(req_id, {}))

    else:
        return JSONResponse(content=_jsonrpc_error(req_id, -32601, f"Method not found: {method}"))


@router.get("/sse")
async def mcp_sse_endpoint(request: Request):
    """MCP SSE endpoint (backwards compatibility for older clients)."""
    # Return endpoint event for old SSE transport
    async def event_generator():
        yield f"event: endpoint\ndata: /mcp\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
