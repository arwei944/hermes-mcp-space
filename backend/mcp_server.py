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
        "version": os.environ.get("APP_VERSION", "2.0.0"),
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
    tools = [
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
            "name": "search_sessions",
            "description": "搜索会话（按标题或模型名模糊匹配）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "搜索关键词"},
                    "limit": {"type": "integer", "default": 10, "description": "返回的最大数量"}
                },
                "required": ["keyword"]
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
            "name": "delete_session",
            "description": "删除指定会话及其所有消息",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "要删除的会话 ID"}
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
            "name": "create_skill",
            "description": "创建一个新技能",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "技能名称（英文、数字、下划线）"},
                    "content": {"type": "string", "description": "技能内容（Markdown 格式）"}
                },
                "required": ["name"]
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
            "name": "write_user_profile",
            "description": "写入/更新用户画像（USER.md）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "用户画像内容（Markdown 格式）"}
                },
                "required": ["content"]
            }
        },
        {
            "name": "list_cron_jobs",
            "description": "列出所有定时任务",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "create_cron_job",
            "description": "创建一个定时任务",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "任务名称"},
                    "schedule": {"type": "string", "description": "Cron 表达式，如 '0 9 * * *'"},
                    "command": {"type": "string", "description": "要执行的命令或任务描述"}
                },
                "required": ["name", "schedule", "command"]
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
        {
            "name": "update_skill",
            "description": "更新指定技能的内容",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "skill_name": {"type": "string", "description": "技能名称"},
                    "content": {"type": "string", "description": "新的技能内容（Markdown 格式）"}
                },
                "required": ["skill_name", "content"]
            }
        },
        {
            "name": "delete_skill",
            "description": "删除指定技能",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "skill_name": {"type": "string", "description": "要删除的技能名称"}
                },
                "required": ["skill_name"]
            }
        },
        {
            "name": "create_session",
            "description": "创建一个新的会话",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "会话标题"},
                    "model": {"type": "string", "description": "使用的模型名称"},
                    "source": {"type": "string", "default": "mcp", "description": "来源（mcp/api/web）"}
                }
            }
        },
        {
            "name": "add_message",
            "description": "向指定会话添加一条消息",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "会话 ID"},
                    "role": {"type": "string", "description": "角色（user/assistant/system）"},
                    "content": {"type": "string", "description": "消息内容"}
                },
                "required": ["session_id", "role", "content"]
            }
        },
        {
            "name": "delete_cron_job",
            "description": "删除指定的定时任务",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "job_id": {"type": "string", "description": "定时任务 ID"}
                },
                "required": ["job_id"]
            }
        },
        {
            "name": "get_logs",
            "description": "获取操作日志（按来源过滤）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 20, "description": "返回的最大日志数"},
                    "source": {"type": "string", "description": "来源过滤（mcp/user/system）"}
                }
            }
        },
        {
            "name": "get_config",
            "description": "获取当前系统配置",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "update_config",
            "description": "更新系统配置",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "temperature": {"type": "number", "description": "模型温度（0-2）"},
                    "log_level": {"type": "string", "description": "日志级别（DEBUG/INFO/WARNING/ERROR）"}
                }
            }
        },
        {
            "name": "list_plugins",
            "description": "列出所有已安装的插件",
            "inputSchema": {"type": "object", "properties": {}}
        },
        {
            "name": "install_plugin",
            "description": "安装插件（name=内置插件名 或 source=Git仓库URL）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "内置插件名称（如 code-analyzer）"},
                    "source": {"type": "string", "description": "Git 仓库 URL"}
                }
            }
        },
        {
            "name": "uninstall_plugin",
            "description": "卸载插件",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "插件名称"}
                },
                "required": ["name"]
            }
        },
        {
            "name": "log_conversation",
            "description": "记录对话消息到会话（Trae 调用此工具记录与用户的对话）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "会话 ID（可选，不传则自动使用最近活跃会话）"},
                    "role": {"type": "string", "description": "消息角色: user / assistant / system", "enum": ["user", "assistant", "system"]},
                    "content": {"type": "string", "description": "消息内容"},
                    "summary": {"type": "string", "description": "对话摘要（可选）"}
                },
                "required": ["role", "content"]
            }
        },
        # ---- Phase 1: 文件操作工具 ----
        {
            "name": "read_file",
            "description": "读取文件内容（支持文本文件，大文件自动截断）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件绝对路径"},
                    "offset": {"type": "integer", "default": 0, "description": "起始行号（从0开始）"},
                    "limit": {"type": "integer", "default": 500, "description": "最大读取行数"}
                },
                "required": ["path"]
            }
        },
        {
            "name": "write_file",
            "description": "写入文件内容（自动创建父目录）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "文件绝对路径"},
                    "content": {"type": "string", "description": "要写入的内容"}
                },
                "required": ["path", "content"]
            }
        },
        {
            "name": "list_directory",
            "description": "列出目录内容（文件和子目录）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "目录绝对路径"},
                    "pattern": {"type": "string", "description": "glob 过滤模式（如 *.py）"}
                },
                "required": ["path"]
            }
        },
        {
            "name": "search_files",
            "description": "在目录中搜索包含指定内容的文件",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "搜索根目录"},
                    "pattern": {"type": "string", "description": "搜索内容（正则表达式）"},
                    "file_pattern": {"type": "string", "description": "文件过滤（如 *.py）"},
                    "max_results": {"type": "integer", "default": 20, "description": "最大结果数"}
                },
                "required": ["path", "pattern"]
            }
        },
        # ---- Phase 1: 终端执行工具 ----
        {
            "name": "shell_execute",
            "description": "执行 shell 命令并返回输出（有超时和输出大小限制）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "要执行的命令"},
                    "timeout": {"type": "integer", "default": 30, "description": "超时秒数（最大120）"},
                    "cwd": {"type": "string", "description": "工作目录"}
                },
                "required": ["command"]
            }
        },
        # ---- Phase 1: Web 搜索工具 ----
        {
            "name": "web_search",
            "description": "搜索网页内容（使用 DuckDuckGo）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "max_results": {"type": "integer", "default": 5, "description": "最大结果数"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "web_fetch",
            "description": "抓取网页内容并返回纯文本",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "网页 URL"},
                    "max_length": {"type": "integer", "default": 5000, "description": "最大返回字符数"}
                },
                "required": ["url"]
            }
        },
        # ---- Phase 2: 全文搜索工具 ----
        {
            "name": "search_messages",
            "description": "全文搜索所有会话消息内容（SQLite FTS5）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "session_id": {"type": "string", "description": "限定会话 ID（可选）"},
                    "limit": {"type": "integer", "default": 20, "description": "最大结果数"}
                },
                "required": ["query"]
            }
        },
        # ---- Phase 2: Context Files ----
        {
            "name": "read_soul",
            "description": "读取 Agent 人格定义（SOUL.md）",
            "inputSchema": {
                "type": "object",
                "properties": {},
            }
        },
        {
            "name": "write_soul",
            "description": "写入 Agent 人格定义（SOUL.md）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "人格定义内容（Markdown 格式）"}
                },
                "required": ["content"]
            }
        },
    ]

    # 合并插件提供的工具
    try:
        from backend.services.plugin_service import get_plugin_tools
        plugin_tools = get_plugin_tools()
        for pt in plugin_tools:
            # 转换为 MCP 工具格式
            tools.append({
                "name": pt.get("name", ""),
                "description": pt.get("description", ""),
                "inputSchema": pt.get("inputSchema", {"type": "object", "properties": {}}),
                "source": "plugin",
                "plugin_name": pt.get("plugin_name", ""),
            })
    except Exception as e:
        logger.warning(f"加载插件工具失败: {e}")

    return tools


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
                f"- [{s.get('id', '?')}] {s.get('title', s.get('source', '?'))} | "
                f"{s.get('model', '?')} | {s.get('created_at', '?')}"
            )
        return f"共 {len(sessions)} 个会话:\n" + "\n".join(lines)

    elif name == "search_sessions":
        keyword = arguments["keyword"].lower()
        limit = arguments.get("limit", 10)
        sessions = hermes_service.list_sessions()
        matched = [
            s for s in sessions
            if keyword in str(s.get("title", "")).lower()
            or keyword in str(s.get("model", "")).lower()
            or keyword in str(s.get("id", "")).lower()
        ]
        result = matched[:limit]
        if not result:
            return f"没有找到包含 '{arguments['keyword']}' 的会话"
        lines = []
        for s in result:
            lines.append(
                f"- [{s.get('id', '?')}] {s.get('title', '?')} | {s.get('model', '?')}"
            )
        return f"找到 {len(matched)} 个匹配会话:\n" + "\n".join(lines)

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

    elif name == "write_user_profile":
        result = hermes_service.update_memory(user=arguments["content"])
        return result.get("message", "操作完成")

    elif name == "delete_session":
        success = hermes_service.delete_session(arguments["session_id"])
        return f"会话 {arguments['session_id']} 已删除" if success else f"删除失败：会话 {arguments['session_id']} 不存在"

    elif name == "create_skill":
        result = hermes_service.create_skill(
            name=arguments["name"],
            content=arguments.get("content", ""),
        )
        return result.get("message", "操作完成")

    elif name == "list_cron_jobs":
        jobs = hermes_service.list_cron_jobs()
        if not jobs:
            return "当前没有定时任务"
        lines = []
        for j in jobs:
            status = "✅" if j.get("status") == "active" else "⏸️"
            lines.append(
                f"{status} [{j.get('id', '?')}] {j.get('name', '?')} | "
                f"{j.get('schedule', '?')} | {j.get('command', '?')}"
            )
        return f"共 {len(jobs)} 个定时任务:\n" + "\n".join(lines)

    elif name == "create_cron_job":
        result = hermes_service.create_cron_job({
            "name": arguments["name"],
            "schedule": arguments["schedule"],
            "command": arguments["command"],
        })
        return result.get("message", "操作完成")

    elif name == "get_system_status":
        status = hermes_service.get_mcp_status()
        return (
            f"Hermes Agent 系统状态:\n"
            f"- MCP 服务: {status.get('status', 'unknown')}\n"
            f"- Hermes 可用: {'是' if hermes_service.hermes_available else '否'}\n"
            f"- 版本: {os.environ.get('APP_VERSION', '2.4.0')}"
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

    elif name == "update_skill":
        result = hermes_service.update_skill(
            name=arguments["skill_name"],
            content=arguments["content"],
        )
        return result.get("message", "操作完成")

    elif name == "delete_skill":
        result = hermes_service.delete_skill(arguments["skill_name"])
        return result.get("message", "操作完成")

    elif name == "create_session":
        result = hermes_service.create_session(
            title=arguments.get("title", ""),
            model=arguments.get("model", ""),
            source=arguments.get("source", "mcp"),
        )
        session = result.get("session", {})
        session_id = session.get("id", "")
        return f"会话创建成功\nID: {session_id}\n标题: {session.get('title', '')}\n来源: {session.get('source', '')}"

    elif name == "add_message":
        result = hermes_service.add_session_message(
            session_id=arguments["session_id"],
            role=arguments["role"],
            content=arguments["content"],
        )
        return result.get("message", "操作完成")

    elif name == "delete_cron_job":
        result = hermes_service.delete_cron_job(arguments["job_id"])
        return result.get("message", "操作完成")

    elif name == "get_logs":
        from backend.routers.logs import _load_logs
        logs = _load_logs()
        source = arguments.get("source")
        if source:
            logs = [l for l in logs if l.get("source") == source]
        limit = arguments.get("limit", 20)
        logs = logs[:limit]
        if not logs:
            return "当前没有日志记录"
        lines = []
        for log in logs:
            lines.append(
                f"- [{log.get('source', '?')}] {log.get('action', '?')} | {log.get('timestamp', '?')}"
            )
        return f"共 {len(logs)} 条日志:\n" + "\n".join(lines)

    elif name == "get_config":
        from backend.config import get_config
        config = get_config()
        # 脱敏
        sensitive = {"api_key", "token", "password", "secret"}
        safe = {}
        for k, v in config.items():
            if any(s in k.lower() for s in sensitive):
                safe[k] = "****"
            else:
                safe[k] = v
        return json.dumps(safe, ensure_ascii=False, indent=2)

    elif name == "update_config":
        import yaml
        from backend.config import get_hermes_home, reload_config
        hermes_home = get_hermes_home()
        config_path = hermes_home / "config.yaml"
        existing = {}
        if config_path.exists():
            try:
                existing = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            except Exception:
                pass
        existing.update(arguments)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(yaml.dump(existing, allow_unicode=True, default_flow_style=False), encoding="utf-8")
        reload_config()  # 清除缓存，使 get_config 读取最新配置
        return f"配置已更新: {', '.join(arguments.keys())}"

    # ---- 插件管理 ----
    elif name == "list_plugins":
        from backend.services.plugin_service import plugin_service
        plugins = plugin_service.list_plugins()
        if not plugins:
            return "暂无已安装插件"
        lines = [f"📦 {p['name']} v{p.get('version','?')} - {p.get('description','无描述')} (by {p.get('author','未知')})" for p in plugins]
        return "\n".join(lines)

    elif name == "install_plugin":
        from backend.services.plugin_service import plugin_service
        plugin_name = arguments.get("name", "")
        source = arguments.get("source", "")
        if plugin_name:
            # 按名称安装内置插件
            result = plugin_service.install_builtin(plugin_name)
        elif source:
            # 按 Git URL 安装
            result = plugin_service.install_plugin(source)
        else:
            return "错误: 请提供 name（内置插件名）或 source（Git 仓库 URL）参数"
        return result.get("message", "安装完成")

    elif name == "uninstall_plugin":
        from backend.services.plugin_service import plugin_service
        plugin_name = arguments.get("name", "")
        if not plugin_name:
            return "错误: 请提供 name 参数"
        result = plugin_service.uninstall_plugin(plugin_name)
        return result.get("message", "卸载完成")

    elif name == "log_conversation":
        role = arguments.get("role", "user")
        content = arguments.get("content", "")
        session_id = arguments.get("session_id", "")
        summary = arguments.get("summary", "")

        # 如果没有指定 session_id，使用最近活跃会话
        if not session_id:
            sessions = hermes_service.list_sessions()
            active = [s for s in sessions if s.get("status") == "active"]
            if active:
                session_id = active[0].get("id") or active[0].get("session_id", "")
            elif sessions:
                session_id = sessions[0].get("id") or sessions[0].get("session_id", "")

        if not session_id:
            # 自动创建会话
            result = hermes_service.create_session(title=summary or "Trae 对话", source="trae")
            session_id = result.get("session", {}).get("id", "")

        if not session_id:
            return "错误: 无法获取或创建会话"

        hermes_service.add_session_message(session_id, role, content)
        from backend.routers.logs import add_log
        add_log("记录对话", session_id[:16], f"[{role}] {content[:100]}", "info", "trae")
        return f"对话已记录到会话 {session_id[:16]}"

    # ---- Phase 1: 文件操作工具 ----
    elif name == "read_file":
        import os as _os
        fpath = arguments.get("path", "")
        offset = int(arguments.get("offset", 0))
        limit = int(arguments.get("limit", 500))
        if not _os.path.isfile(fpath):
            raise ValueError(f"文件不存在: {fpath}")
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            total = len(lines)
            selected = lines[offset:offset + limit]
            content = "".join(selected)
            header = f"文件: {fpath}\n总行数: {total}\n显示: 第 {offset+1}-{min(offset+limit, total)} 行\n{'='*50}\n"
            return header + content
        except Exception as e:
            raise ValueError(f"读取文件失败: {e}")

    elif name == "write_file":
        import os as _os
        fpath = arguments.get("path", "")
        content = arguments.get("content", "")
        if not fpath:
            raise ValueError("请提供文件路径")
        try:
            _os.makedirs(_os.path.dirname(fpath), exist_ok=True)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            return f"文件已写入: {fpath} ({len(content)} 字符)"
        except Exception as e:
            raise ValueError(f"写入文件失败: {e}")

    elif name == "list_directory":
        import os as _os
        dpath = arguments.get("path", "")
        pattern = arguments.get("pattern", "")
        if not _os.path.isdir(dpath):
            raise ValueError(f"目录不存在: {dpath}")
        try:
            import glob as _glob
            if pattern:
                items = _glob.glob(_os.path.join(dpath, pattern))
            else:
                items = _os.listdir(dpath)
            result = []
            for item in sorted(items):
                full = item if _os.path.isabs(item) else _os.path.join(dpath, item)
                if _os.path.isdir(full):
                    result.append(f"📁 {item}/")
                else:
                    size = _os.path.getsize(full)
                    result.append(f"📄 {item} ({size} bytes)")
            return f"目录: {dpath}\n{'='*50}\n" + "\n".join(result) if result else "空目录"
        except Exception as e:
            raise ValueError(f"列出目录失败: {e}")

    elif name == "search_files":
        import os as _os
        root = arguments.get("path", "")
        pattern = arguments.get("pattern", "")
        file_pattern = arguments.get("file_pattern", "")
        max_results = int(arguments.get("max_results", 20))
        if not _os.path.isdir(root):
            raise ValueError(f"目录不存在: {root}")
        try:
            import re as _re
            import glob as _glob
            regex = _re.compile(pattern)
            results = []
            # 收集文件
            if file_pattern:
                files = []
                for ext in _glob.glob(_os.path.join(root, "**", file_pattern), recursive=True):
                    if _os.path.isfile(ext):
                        files.append(ext)
            else:
                files = []
                for dirpath, dirnames, filenames in _os.walk(root):
                    for fn in filenames:
                        files.append(_os.path.join(dirpath, fn))
            # 搜索
            for fpath in files:
                if len(results) >= max_results:
                    break
                try:
                    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                        for i, line in enumerate(f, 1):
                            if regex.search(line):
                                results.append(f"{fpath}:{i}: {line.strip()[:120]}")
                                if len(results) >= max_results:
                                    break
                except Exception:
                    continue
            if not results:
                return f"在 {root} 中未找到匹配 '{pattern}' 的内容"
            return f"搜索: {pattern} in {root}\n找到 {len(results)} 条结果\n{'='*50}\n" + "\n".join(results)
        except Exception as e:
            raise ValueError(f"搜索失败: {e}")

    # ---- Phase 1: 终端执行工具 ----
    elif name == "shell_execute":
        import subprocess as _subprocess
        command = arguments.get("command", "")
        timeout = min(int(arguments.get("timeout", 30)), 120)
        cwd = arguments.get("cwd", "")
        if not command:
            raise ValueError("请提供命令")
        try:
            result = _subprocess.run(
                command, shell=True, capture_output=True, text=True,
                timeout=timeout, cwd=cwd or None,
                env={**_subprocess.os.environ, "PAGER": "cat"}
            )
            output = result.stdout or ""
            error = result.stderr or ""
            # 截断过长输出
            max_output = 10000
            if len(output) > max_output:
                output = output[:max_output] + f"\n... (输出已截断，共 {len(result.stdout)} 字符)"
            if len(error) > max_output:
                error = error[:max_output] + f"\n... (错误已截断)"
            parts = [f"命令: {command}"]
            if cwd:
                parts.append(f"工作目录: {cwd}")
            parts.append(f"退出码: {result.returncode}")
            if output:
                parts.append(f"\n--- stdout ---\n{output}")
            if error:
                parts.append(f"\n--- stderr ---\n{error}")
            return "\n".join(parts)
        except _subprocess.TimeoutExpired:
            raise ValueError(f"命令执行超时（{timeout}秒）")
        except Exception as e:
            raise ValueError(f"命令执行失败: {e}")

    # ---- Phase 1: Web 搜索工具 ----
    elif name == "web_search":
        query = arguments.get("query", "")
        max_results = int(arguments.get("max_results", 5))
        if not query:
            raise ValueError("请提供搜索关键词")
        try:
            from duckduckgo_search import DDGS
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results):
                    results.append(f"标题: {r.get('title', '')}\n链接: {r.get('href', '')}\n摘要: {r.get('body', '')}")
            if not results:
                return f"未找到 '{query}' 的搜索结果"
            return f"搜索: {query}\n{'='*50}\n\n" + "\n\n---\n\n".join(results)
        except ImportError:
            # 降级：使用 requests + DuckDuckGo HTML
            try:
                import urllib.parse as _up
                import urllib.request as _ur
                import re as _re
                url = f"https://html.duckduckgo.com/html/?q={_up.quote(query)}"
                req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with _ur.urlopen(req, timeout=10) as resp:
                    html = resp.read().decode("utf-8", errors="replace")
                # 提取搜索结果
                results = _re.findall(r'class="result__a"[^>]*>(.*?)</a>.*?class="result__snippet"[^>]*>(.*?)</a>', html, _re.DOTALL)
                if not results:
                    return f"未找到 '{query}' 的搜索结果"
                output = []
                for i, (title, snippet) in enumerate(results[:max_results]):
                    clean_title = _re.sub(r'<[^>]+>', '', title).strip()
                    clean_snippet = _re.sub(r'<[^>]+>', '', snippet).strip()
                    output.append(f"{i+1}. {clean_title}\n   {clean_snippet}")
                return f"搜索: {query}\n{'='*50}\n\n" + "\n\n".join(output)
            except Exception as e:
                raise ValueError(f"搜索失败: {e}")

    elif name == "web_fetch":
        url = arguments.get("url", "")
        max_length = int(arguments.get("max_length", 5000))
        if not url:
            raise ValueError("请提供 URL")
        try:
            import urllib.request as _ur
            import re as _re
            req = _ur.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with _ur.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="replace")
            # 移除 script/style 标签
            html = _re.sub(r'<script[^>]*>.*?</script>', '', html, flags=_re.DOTALL | _re.IGNORECASE)
            html = _re.sub(r'<style[^>]*>.*?</style>', '', html, flags=_re.DOTALL | _re.IGNORECASE)
            # 移除 HTML 标签
            text = _re.sub(r'<[^>]+>', ' ', html)
            # 清理空白
            text = _re.sub(r'\s+', ' ', text).strip()
            if len(text) > max_length:
                text = text[:max_length] + f"\n... (内容已截断，共 {len(text)} 字符)"
            return f"URL: {url}\n长度: {len(text)} 字符\n{'='*50}\n{text}"
        except Exception as e:
            raise ValueError(f"抓取网页失败: {e}")

    # ---- Phase 2: 全文搜索工具 ----
    elif name == "search_messages":
        query = arguments.get("query", "")
        session_id = arguments.get("session_id")
        limit = int(arguments.get("limit", 20))
        if not query:
            raise ValueError("请提供搜索关键词")
        try:
            from backend.services.hermes_service import hermes_service
            results = hermes_service.search_messages(query, session_id, limit)
            if not results:
                return f"未找到匹配 '{query}' 的消息"
            output = [f"搜索: {query} | 找到 {len(results)} 条结果\n{'='*50}"]
            for r in results:
                content_preview = r["content"][:150].replace("\n", " ")
                output.append(f"[{r['role']}] ({r['session_id'][:12]}...) {content_preview}")
            return "\n".join(output)
        except Exception as e:
            raise ValueError(f"搜索失败: {e}")

    # ---- Phase 2: Context Files ----
    elif name == "read_soul":
        try:
            from backend.config import get_hermes_home
            soul_path = get_hermes_home() / "SOUL.md"
            if soul_path.exists():
                content = soul_path.read_text(encoding="utf-8")
                return f"SOUL.md ({len(content)} 字符)\n{'='*50}\n{content}"
            else:
                return "SOUL.md 尚未创建。使用 write_soul 工具创建 Agent 人格定义。"
        except Exception as e:
            raise ValueError(f"读取 SOUL.md 失败: {e}")

    elif name == "write_soul":
        content = arguments.get("content", "")
        if not content:
            raise ValueError("请提供人格定义内容")
        try:
            from backend.config import get_hermes_home
            soul_path = get_hermes_home() / "SOUL.md"
            soul_path.parent.mkdir(parents=True, exist_ok=True)
            soul_path.write_text(content, encoding="utf-8")
            return f"SOUL.md 已更新 ({len(content)} 字符)"
        except Exception as e:
            raise ValueError(f"写入 SOUL.md 失败: {e}")

    else:
        raise ValueError(f"未知工具: {name}")


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
                emit_event("mcp.tool_call", {"tool": tool_name, "arguments": arguments}, source="mcp")
            except Exception:
                pass

            result_text = await _call_tool(tool_name, arguments)
            return JSONResponse(content=_jsonrpc_response(req_id, {
                "content": [{"type": "text", "text": result_text}]
            }))
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
