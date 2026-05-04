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

    instructions = f"""你是 Hermes AI 助手（角色：{role_label}，ID：{agent_id}）。

## 🧠 记忆系统（必须遵守）

你拥有一个持久化记忆系统，所有通过此 MCP 提供的工具（submit_conversation、add_learning、memory_create 等）都会将数据持久化存储。
**这意味着：你调用这些工具保存的信息，在下次对话中依然可用。如果你不保存，下次对话你将忘记一切。**

### 每次对话结束时，你必须执行以下操作：

1. **调用 `submit_conversation`** — 将本次对话的完整内容（用户说了什么、你回答了什么）提交保存。
   - 格式：`{{"messages": [{{"role": "user", "content": "用户的问题"}}, {{"role": "assistant", "content": "你的回答"}}]}}`
   - 这是你保留记忆的唯一方式，不提交 = 下次忘记

2. **如果用户表达了偏好**（比如"我喜欢X"、"以后都按Y格式"）→ 调用 `memory_create` 保存

3. **如果你犯了错误并修正了** → 调用 `add_learning` 记录经验，避免下次重犯

4. **如果用户对你的回答表示满意或不满** → 调用 `submit_feedback` 记录反馈

### 为什么必须这样做？
- 你的记忆不会自动保存，只有通过工具调用才能持久化
- 不保存 = 每次对话都是全新开始，你无法积累经验
- 保存了 = 你会越来越了解用户，犯错越来越少，服务越来越好

"""

    try:
        from backend.services.context_budget_service import ContextBudgetService
        ctx_svc = ContextBudgetService()
        context = ctx_svc.build_context(agent_id=agent_id, max_tokens=2000)
        if context and context.strip():
            instructions += "\n## 📚 当前知识上下文\n以下是系统为你积累的知识和经验，请在回答时参考：\n\n" + context + "\n"
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

def _capture_tool_content(tool_name: str, arguments: Dict[str, Any], result_text: str, session_id: str, agent_id: str):
    """从工具调用参数中自动提取有价值的内容，作为对话数据的保底捕获"""
    content_to_save = None
    role = "assistant"

    # 这些工具的参数本身包含对话内容
    content_tools = {
        "add_message": arguments.get("content", ""),
        "submit_conversation": None,  # 已经有自己的存储逻辑，跳过
        "memory_create": arguments.get("content", arguments.get("text", "")),
        "add_learning": arguments.get("content", arguments.get("text", "")),
        "knowledge_create": arguments.get("content", arguments.get("text", "")),
        "experience_create": arguments.get("content", arguments.get("text", "")),
    }

    if tool_name in content_tools and content_tools[tool_name] is not None:
        content_to_save = content_tools[tool_name]
        if tool_name == "add_message":
            role = arguments.get("role", "assistant")

    # shell_execute 的 command 也值得记录
    elif tool_name == "shell_execute":
        cmd = arguments.get("command", "")
        if cmd and len(cmd) > 5:
            content_to_save = f"[执行命令] {cmd}"

    # web_search 的 query 值得记录
    elif tool_name == "web_search":
        query = arguments.get("query", "")
        if query:
            content_to_save = f"[搜索] {query}"

    # web_fetch 的 url 值得记录
    elif tool_name == "web_fetch":
        url = arguments.get("url", "")
        if url:
            content_to_save = f"[访问] {url}"

    if not content_to_save or not isinstance(content_to_save, str) or len(content_to_save.strip()) < 3:
        return

    try:
        from backend.services.hermes_service import hermes_service as _hs
        _hs.add_session_message(
            session_id=session_id, role=role, content=str(content_to_save)[:2000],
            metadata={"tool": tool_name, "auto_captured": True, "agent_id": agent_id}
        )
        logger.debug(f"Auto-captured content from {tool_name}: {len(content_to_save)} chars")
    except Exception as e:
        logger.debug(f"Failed to auto-capture content: {e}")

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
        # 从 HTTP header 获取 session ID（MCP 协议标准方式）
        mcp_session_id = request.headers.get("mcp-session-id", "")
        session_info = _sessions.get(mcp_session_id, {})
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
                session_lifecycle.on_tool_call(mcp_session_id)
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
                # 参数捕获保底：自动从工具调用中提取对话内容存入会话
                try:
                    _capture_tool_content(tool_name, arguments, result_text, hermes_session_id, agent_id)
                except Exception: pass
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