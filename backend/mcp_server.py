from backend.version import __version__
# -*- coding: utf-8 -*-
"""
Hermes Agent - MCP Server (v9: ToolRegistry architecture)
Phase 4: Replace hardcoded _get_tools() / _call_tool() with ToolRegistry + Middleware.

Config switch:
    USE_TOOL_REGISTRY = True   -> new architecture (registry + middleware)
    USE_TOOL_REGISTRY = False  -> legacy fallback (should never be needed)
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

# v9 imports
from backend.mcp.registry import registry
from backend.mcp.middleware import (
    AutoLearnMiddleware,
    MCPMiddlewarePipeline,
    LoggingMiddleware,
    ErrorHandlingMiddleware,
)

logger = logging.getLogger("hermes-mcp")

router = APIRouter(tags=["mcp-protocol"])

# Session storage
_sessions: Dict[str, Dict] = {}

# ---------------------------------------------------------------------------
# v9 config switch
# ---------------------------------------------------------------------------
USE_TOOL_REGISTRY = True  # True=新架构, False=旧架构(应急回退)

# ---------------------------------------------------------------------------
# Middleware pipeline (shared singleton)
# ---------------------------------------------------------------------------
_pipeline = MCPMiddlewarePipeline()
_pipeline.add(LoggingMiddleware())
_pipeline.add(ErrorHandlingMiddleware())
_pipeline.add(AutoLearnMiddleware())

# Auto-discover all tool modules on import
registry.discover()


# =========================================================================
# Utility helpers (kept from original)
# =========================================================================

def _get_server_info():
    return {
        "name": "Hermes Agent",
        "version": __version__,
    }


def _get_capabilities():
    return {
        "experimental": {},
        "prompts": {"listChanged": False},
        "resources": {"subscribe": False, "listChanged": False},
        "tools": {"listChanged": False},
    }


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


def _summarize_tool_args(tool_name: str, args: Dict[str, Any], max_len: int = 200) -> str:
    """将工具调用参数摘要为一行可读文本"""
    if not args:
        return "(无参数)"
    if tool_name == "add_message":
        role = args.get("role", "?")
        content = str(args.get("content", ""))[:max_len]
        return f"[{role}] {content}"
    if tool_name in ("write_memory", "write_user_profile", "write_soul", "write_agents_md"):
        content = str(args.get("content", ""))[:max_len]
        return content
    if tool_name == "shell_execute":
        return f"$ {args.get('command', '')}"
    if tool_name == "web_search":
        return f"搜索: {args.get('query', '')}"
    if tool_name == "create_skill":
        return f"创建技能 [{args.get('name', '')}]: {str(args.get('content', ''))[:80]}"
    if tool_name == "web_fetch":
        return f"抓取: {args.get('url', '')}"
    # 通用摘要
    parts = []
    for k, v in list(args.items())[:4]:
        sv = str(v)
        if len(sv) > 60:
            sv = sv[:60] + "..."
        parts.append(f"{k}={sv}")
    result = ", ".join(parts)
    if len(result) > max_len:
        result = result[:max_len] + "..."
    return result


# =========================================================================
# _get_tools() — v9: delegate to registry + plugin + external MCP
# =========================================================================

def _get_tools():
    """Return the combined list of all available MCP tools.

    Sources (in order):
      1. ToolRegistry (auto-discovered from backend/mcp/tools/)
      2. Plugin tools (from plugin_service.get_plugin_tools())
      3. External MCP tools (from mcp_client_service)
    """
    tools = registry.get_tools()

    # 合并插件提供的工具
    try:
        from backend.services.plugin_service import get_plugin_tools
        plugin_tools = get_plugin_tools()
        for pt in plugin_tools:
            tools.append({
                "name": pt.get("name", ""),
                "description": pt.get("description", ""),
                "inputSchema": pt.get("inputSchema", {"type": "object", "properties": {}}),
                "source": "plugin",
                "plugin_name": pt.get("plugin_name", ""),
            })
    except Exception as e:
        logger.warning(f"加载插件工具失败: {e}")

    # 合并外部 MCP 服务器的工具（网关模式）
    try:
        from backend.services.mcp_client_service import mcp_client_service
        external_tools = mcp_client_service.get_external_tools()
        tools.extend(external_tools)
        if external_tools:
            logger.info(f"聚合 {len(external_tools)} 个外部 MCP 工具")
    except Exception as e:
        logger.warning(f"加载外部 MCP 工具失败: {e}")

    return tools


# =========================================================================
# _call_tool() — v9: registry.call() with middleware pipeline
# =========================================================================

async def _call_tool(name: str, arguments: Dict[str, Any]) -> str:
    """Execute a tool and return the result as text.

    Dispatch order:
      1. External MCP tools (mcp_client_service.is_external_tool)
      2. Registry tools (via middleware pipeline)
      3. Fallback: raise ValueError for unknown tools
    """
    from backend.services.mcp_client_service import mcp_client_service

    # ---- 1. 外部 MCP 工具路由 ----
    if mcp_client_service.is_external_tool(name):
        try:
            result = mcp_client_service.call_external_tool(name, arguments)
            if isinstance(result, dict):
                if "error" in result:
                    raise ValueError(
                        f"{result['error']}\n"
                        "建议：\n"
                        "1. 使用 refresh_mcp_servers 工具刷新外部服务器连接状态\n"
                        "2. 检查外部 MCP 服务器是否正常运行\n"
                        "3. 确认网络连接正常，服务器地址可访问"
                    )
                content_list = result.get("result", {}).get("content", [])
                if content_list:
                    return "\n".join(c.get("text", "") for c in content_list)
                return json.dumps(result.get("result", {}), ensure_ascii=False, indent=2)
            return str(result)
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(
                f"调用外部工具 '{name}' 失败: {e}\n"
                "建议：\n"
                "1. 使用 refresh_mcp_servers 刷新服务器连接后重试\n"
                "2. 检查传递给工具的参数是否符合要求\n"
                "3. 确认外部 MCP 服务器正在运行且网络可达"
            )

    # ---- 2. Registry 工具 (通过中间件管道) ----
    try:
        result = await _pipeline.execute(
            tool_name=name,
            arguments=arguments,
            registry=registry,
        )
        # registry handler 返回的可能是 dict / str / list 等，统一转 str
        if isinstance(result, dict):
            return json.dumps(result, ensure_ascii=False, indent=2)
        return str(result) if result is not None else ""
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"工具 '{name}' 执行失败: {e}")

    # ---- 3. 未知工具 ----
    raise ValueError(
        f"未知工具: {name}\n"
        "建议：\n"
        "1. 使用 list_tools 工具查看所有可用的内置工具列表\n"
        "2. 如果要使用外部 MCP 工具，请先通过 add_mcp_server 添加对应服务器\n"
        "3. 检查工具名称拼写是否正确，注意大小写"
    )


# =========================================================================
# _read_resource() — kept from original
# =========================================================================

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


# =========================================================================
# JSON-RPC helpers — kept from original
# =========================================================================

def _jsonrpc_response(id_val, result):
    return {"jsonrpc": "2.0", "id": id_val, "result": result}


def _jsonrpc_error(id_val, code, message):
    return {"jsonrpc": "2.0", "id": id_val, "error": {"code": code, "message": message}}


# =========================================================================
# MCP endpoint — main handler (kept structure, uses new _get_tools/_call_tool)
# =========================================================================

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
            # 自动记录到实时会话（SOLO 对话追踪）
            try:
                from backend.services.hermes_service import hermes_service as _hs
                call_summary = f"[{tool_name}] " + _summarize_tool_args(tool_name, arguments)
                _hs.add_session_message(
                    session_id="solo_realtime",
                    role="assistant",
                    content=call_summary,
                    metadata={"tool": tool_name, "auto": True},
                )
            except Exception:
                pass

            # 记录 MCP 工具调用日志
            try:
                from backend.routers.logs import add_log
                from backend.routers.events import emit_event
                arg_preview = str(arguments)[:100] if arguments else ""
                add_log(
                    action=f"MCP 调用: {tool_name}",
                    target=tool_name,
                    detail=arg_preview,
                    level="info",
                    source="mcp",
                )
                emit_event("mcp.tool_call", {"tool": tool_name, "arguments": arguments, "status": "start"}, source="mcp")
            except Exception:
                pass

            # 工具调用追踪
            from backend.services import eval_service
            start = time.time()
            try:
                result_text = await _call_tool(tool_name, arguments)
                latency = int((time.time() - start) * 1000)
                eval_service.record_tool_call(tool_name, arguments, True, latency, "", "mcp")
                # 自动增量学习（成功调用）
                try:
                    from backend.services.auto_learner import run_incremental_learning
                    run_incremental_learning(tool_name, True)
                except Exception:
                    pass
                # 发送完成事件
                try:
                    from backend.routers.events import emit_event
                    emit_event("mcp.tool_complete", {
                        "tool": tool_name, "ok": True, "ms": latency,
                        "summary": result_text[:200] if result_text else "",
                    }, source="mcp")
                except Exception:
                    pass
                return JSONResponse(content=_jsonrpc_response(req_id, {
                    "content": [{"type": "text", "text": result_text}]
                }))
            except Exception as e:
                latency = int((time.time() - start) * 1000)
                eval_service.record_tool_call(tool_name, arguments, False, latency, str(e), "mcp")
                # 自动增量学习（失败调用 — 更积极触发）
                try:
                    from backend.services.auto_learner import run_incremental_learning
                    run_incremental_learning(tool_name, False, str(e))
                except Exception:
                    pass
                # 发送失败事件
                try:
                    from backend.routers.events import emit_event
                    emit_event("mcp.tool_complete", {
                        "tool": tool_name, "ok": False, "ms": latency,
                        "error": str(e)[:200],
                    }, source="mcp")
                except Exception:
                    pass
                raise
        except Exception as e:
            # 记录 MCP 调用失败
            try:
                from backend.routers.logs import add_log
                add_log(
                    action=f"MCP 失败: {tool_name}",
                    target=tool_name,
                    detail=str(e)[:200],
                    level="error",
                    source="mcp",
                )
            except Exception:
                pass
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


# =========================================================================
# SSE endpoint — kept from original
# =========================================================================

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
            "X-Accel-Buffering": "no",
        },
    )
