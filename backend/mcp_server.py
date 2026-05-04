from backend.version import __version__
# -*- coding: utf-8 -*-
"""
Hermes Agent - MCP Server (v9: ToolRegistry architecture)
"""

import json
import logging
import os
import re
import time
import urllib.parse
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from backend.mcp.registry import registry
from backend.mcp.middleware import (
    AutoLearnMiddleware, MCPMiddlewarePipeline, LoggingMiddleware, ErrorHandlingMiddleware,
)

logger = logging.getLogger("hermes-mcp")
router = APIRouter(tags=["mcp-protocol"])
_sessions: Dict[str, Dict] = {}
USE_TOOL_REGISTRY = True

_pipeline = MCPMiddlewarePipeline()
_pipeline.add(LoggingMiddleware())
_pipeline.add(ErrorHandlingMiddleware())
_pipeline.add(AutoLearnMiddleware(auto_learner="lazy"))
registry.discover()


def _get_server_info():
    return {"name": "Hermes Agent", "version": __version__}

def _get_capabilities():
    return {"experimental": {}, "prompts": {"listChanged": False}, "resources": {"subscribe": False, "listChanged": False}, "tools": {"listChanged": False}}

def _build_agent_instructions(agent_id: str, client_info: dict) -> str:
    role = "general"
    role_label = "通用助手"
    try:
        from backend.services.agent_identity import agent_identity_manager, AGENT_ROLES
        agent = agent_identity_manager.get_agent(agent_id)
        if agent:
            role = agent.get("role", "general")
            role_info = AGENT_ROLES.get(role, AGENT_ROLES.get("general", {}))
            role_label = role_info.get("label", "通用助手")
    except Exception: pass
    instructions = f"你是 Hermes AI 助手（角色：{role_label}，ID：{agent_id}）。\n\n"
    instructions += "## 重要行为指引\n"
    instructions += "1. 每次完成一次有意义的对话后，请调用 `submit_conversation` 工具提交对话记录。\n"
    instructions += "2. 遇到错误或异常时，请调用 `add_learning` 记录经验。\n"
    instructions += "3. 如果发现用户有明确的偏好表达，请调用 `memory_create` 记忆。\n"
    instructions += "4. 你可以从知识库中搜索相关信息来辅助回答。\n"
    try:
        from backend.services.context_budget_service import ContextBudgetService
        ctx_svc = ContextBudgetService()
        context = ctx_svc.build_context(agent_id=agent_id, max_tokens=2000)
        if context and context.strip():
            instructions += "\n## 当前知识上下文\n以下是系统为你准备的相关知识：\n\n" + context + "\n"
    except Exception as e:
        logger.debug(f"Failed to build context: {e}")
    return instructions

def _get_resources():
    return [
        {"uri": "hermes://memory", "name": "Agent Memory", "description": "Agent 的长期记忆文件", "mimeType": "text/markdown"},
        {"uri": "hermes://user-profile", "name": "User Profile", "description": "用户画像文件", "mimeType": "text/markdown"},
        {"uri": "hermes://sessions", "name": "Sessions", "description": "会话列表", "mimeType": "application/json"},
        {"uri": "hermes://tools", "name": "Tools", "description": "工具列表", "mimeType": "application/json"},
    ]

def _summarize_tool_args(tool_name: str, args: Dict[str, Any], max_len: int = 200) -> str:
    if not args: return "(无参数)"
    if tool_name == "add_message": return f"[{args.get('role', '?')}] {str(args.get('content', ''))[:max_len]}"
    if tool_name == "shell_execute": return f"$ {args.get('command', '')}"
    if tool_name == "web_search": return f"搜索: {args.get('query', '')}"
    parts = [f"{k}={str(v)[:60]}" for k, v in list(args.items())[:4]]
    result = ", ".join(parts)
    return result[:max_len] + "..." if len(result) > max_len else result

def _get_tools():
    tools = registry.get_tools()
    try:
        from backend.services.plugin_service import get_plugin_tools
        for pt in get_plugin_tools():
            tools.append({"name": pt.get("name", ""), "description": pt.get("description", ""), "inputSchema": pt.get("inputSchema", {"type": "object", "properties": {}}), "source": "plugin"})
    except Exception as e: logger.warning(f"加载插件工具失败: {e}")
    try:
        from backend.services.mcp_client_service import mcp_client_service
        external_tools = mcp_client_service.get_external_tools()
        tools.extend(external_tools)
    except Exception as e: logger.warning(f"加载外部 MCP 工具失败: {e}")
    return tools

async def _call_tool(name: str, arguments: Dict[str, Any]) -> str:
    from backend.services.mcp_client_service import mcp_client_service
    if mcp_client_service.is_external_tool(name):
        try:
            result = mcp_client_service.call_external_tool(name, arguments)
            if isinstance(result, dict):
                if "error" in result: raise ValueError(f"{result['error']}")
                content_list = result.get("result", {}).get("content", [])
                if content_list: return "\n".join(c.get("text", "") for c in content_list)
                return json.dumps(result.get("result", {}), ensure_ascii=False, indent=2)
            return str(result)
        except ValueError: raise
        except Exception as e: raise ValueError(f"调用外部工具 '{name}' 失败: {e}")
    try:
        result = await _pipeline.execute(tool_name=name, arguments=arguments, registry=registry)
        if isinstance(result, dict): return json.dumps(result, ensure_ascii=False, indent=2)
        return str(result) if result is not None else ""
    except ValueError: raise
    except Exception as e: raise ValueError(f"工具 '{name}' 执行失败: {e}")
    raise ValueError(f"未知工具: {name}")

async def _read_resource(uri: str) -> str:
    from backend.services.hermes_service import hermes_service
    if uri == "hermes://memory": return hermes_service.read_memory().get("memory", "")
    elif uri == "hermes://user-profile": return hermes_service.read_memory().get("user", "")
    elif uri == "hermes://sessions": return json.dumps(hermes_service.list_sessions(), ensure_ascii=False, indent=2)
    elif uri == "hermes://tools": return json.dumps(hermes_service.list_tools(), ensure_ascii=False, indent=2)
    return f"未知资源: {uri}"

def _jsonrpc_response(id_val, result): return {"jsonrpc": "2.0", "id": id_val, "result": result}
def _jsonrpc_error(id_val, code, message): return {"jsonrpc": "2.0", "id": id_val, "error": {"code": code, "message": message}}

@router.post("/mcp")
async def mcp_endpoint(request: Request):
    body = await request.json()
    jsonrpc, method, params, req_id = body.get("jsonrpc"), body.get("method"), body.get("params", {}), body.get("id")
    if jsonrpc != "2.0": return JSONResponse(content=_jsonrpc_error(req_id, -32600, "Invalid Request"), status_code=400)
    if method == "initialize":
        session_id = str(uuid.uuid4())
        agent_id = "unknown"
        client_info = params.get("clientInfo", {})
        try:
            from backend.services.agent_identity import agent_identity_manager
            agent_result = agent_identity_manager.register_or_update(client_info)
            agent_id = agent_result.get("id", "unknown")
        except Exception as e: logger.warning(f"Agent identity registration failed: {e}")
        try:
            from backend.services.session_lifecycle import session_lifecycle
            hermes_session_id = session_lifecycle.on_agent_connect(session_id, agent_id)
        except Exception as e:
            logger.warning(f"Session lifecycle init failed: {e}")
            hermes_session_id = f"mcp_{session_id[:12]}"
        _sessions[session_id] = {"initialized": True, "agent_id": agent_id, "hermes_session_id": hermes_session_id, "client_info": client_info}
        instructions = _build_agent_instructions(agent_id, client_info)
        response = _jsonrpc_response(req_id, {"protocolVersion": "2025-03-26", "capabilities": _get_capabilities(), "serverInfo": _get_server_info(), "instructions": instructions})
        resp = JSONResponse(content=response)
        resp.headers["Mcp-Session-Id"] = session_id
        return resp
    elif method == "notifications/initialized": return JSONResponse(content=None, status_code=202)
    elif method == "tools/list": return JSONResponse(content=_jsonrpc_response(req_id, {"tools": _get_tools()}))
    elif method == "tools/call":
        tool_name, arguments = params.get("name", ""), params.get("arguments", {})
        session_info = _sessions.get(req_id, {}) if req_id else {}
        agent_id = session_info.get("agent_id", "unknown")
        hermes_session_id = session_info.get("hermes_session_id", "solo_realtime")
        try:
            try:
                from backend.services.hermes_service import hermes_service as _hs
                call_summary = f"[{tool_name}] " + _summarize_tool_args(tool_name, arguments)
                _hs.add_session_message(session_id=hermes_session_id, role="assistant", content=call_summary, metadata={"tool": tool_name, "auto": True, "agent_id": agent_id})
            except Exception: pass
            try:
                from backend.services.session_lifecycle import session_lifecycle
                session_lifecycle.on_tool_call(req_id)
            except Exception: pass
            try:
                from backend.routers.logs import add_log
                from backend.routers.events import emit_event
                add_log(action=f"MCP 调用: {tool_name}", target=tool_name, detail=str(arguments)[:100], level="info", source="mcp")
                emit_event("mcp.tool_call", {"tool": tool_name, "arguments": arguments, "status": "start"}, source="mcp")
            except Exception: pass
            from backend.services import eval_service
            start = time.time()
            try:
                result_text = await _call_tool(tool_name, arguments)
                latency = int((time.time() - start) * 1000)
                eval_service.record_tool_call(tool_name, arguments, True, latency, "", "mcp", agent_id, hermes_session_id)
                try:
                    from backend.services.auto_learner import run_incremental_learning
                    run_incremental_learning(tool_name, True)
                except Exception: pass
                try:
                    from backend.routers.events import emit_event
                    emit_event("mcp.tool_complete", {"tool": tool_name, "ok": True, "ms": latency, "summary": result_text[:200] if result_text else ""}, source="mcp")
                except Exception: pass
                return JSONResponse(content=_jsonrpc_response(req_id, {"content": [{"type": "text", "text": result_text}]}))
            except Exception as e:
                latency = int((time.time() - start) * 1000)
                eval_service.record_tool_call(tool_name, arguments, False, latency, str(e), "mcp", agent_id, hermes_session_id)
                try:
                    from backend.services.auto_learner import run_incremental_learning
                    run_incremental_learning(tool_name, False, str(e))
                except Exception: pass
                try:
                    from backend.routers.events import emit_event
                    emit_event("mcp.tool_complete", {"tool": tool_name, "ok": False, "ms": latency, "error": str(e)[:200]}, source="mcp")
                except Exception: pass
                raise
        except Exception as e:
            try:
                from backend.routers.logs import add_log
                add_log(action=f"MCP 失败: {tool_name}", target=tool_name, detail=str(e)[:200], level="error", source="mcp")
            except Exception: pass
            return JSONResponse(content=_jsonrpc_error(req_id, -32603, str(e)))
    elif method == "resources/list": return JSONResponse(content=_jsonrpc_response(req_id, {"resources": _get_resources()}))
    elif method == "resources/read":
        uri = params.get("uri", "")
        try: return JSONResponse(content=_jsonrpc_response(req_id, {"contents": [{"uri": uri, "mimeType": "text/plain", "text": await _read_resource(uri)}]}))
        except Exception as e: return JSONResponse(content=_jsonrpc_error(req_id, -32603, str(e)))
    elif method == "ping": return JSONResponse(content=_jsonrpc_response(req_id, {}))
    return JSONResponse(content=_jsonrpc_error(req_id, -32601, f"Method not found: {method}"))

@router.get("/sse")
async def mcp_sse_endpoint(request: Request):
    async def event_generator(): yield f"event: endpoint\ndata: /mcp\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})