# -*- coding: utf-8 -*-
"""
Hermes Agent - MCP Server (manual implementation)
手动实现 MCP Streamable HTTP 端点，不依赖 FastMCP.run()。
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
        # ---- AGENTS.md 支持 ----
        {
            "name": "read_agents_md",
            "description": "读取项目级指令文件（AGENTS.md / CLAUDE.md）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "自定义文件路径（可选，默认自动发现）"}
                }
            }
        },
        {
            "name": "write_agents_md",
            "description": "写入项目级指令文件（AGENTS.md）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "项目指令内容（Markdown 格式）"},
                    "path": {"type": "string", "description": "写入路径（默认 ~/.hermes/AGENTS.md）"}
                },
                "required": ["content"]
            }
        },
        # ---- 学习循环 ----
        {
            "name": "read_learnings",
            "description": "读取 Agent 学习记录（从历史经验中学习）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 20, "description": "返回条数"}
                }
            }
        },
        {
            "name": "add_learning",
            "description": "添加一条学习记录（记录工具使用中的发现）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "content": {"type": "string", "description": "学习内容"},
                    "tool": {"type": "string", "description": "相关工具名（可选）"},
                    "error": {"type": "string", "description": "相关错误（可选）"}
                },
                "required": ["content"]
            }
        },
        {
            "name": "compress_session",
            "description": "压缩会话历史（保留最近3轮+最早1轮，中间由摘要替代）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "会话 ID"},
                    "keep_recent": {"type": "integer", "default": 3, "description": "保留最近 N 轮"},
                    "keep_first": {"type": "integer", "default": 1, "description": "保留最早 N 轮"},
                    "summary_max_chars": {"type": "integer", "default": 500, "description": "摘要最大字符数"}
                },
                "required": ["session_id"]
            }
        },
        {
            "name": "suggest_skill",
            "description": "分析会话中的工具调用模式，建议创建可复用技能",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "要分析的会话 ID（可选，默认最近会话）"},
                    "min_calls": {"type": "integer", "default": 3, "description": "最少调用次数才触发建议"}
                },
                "required": []
            }
        },
        {
            "name": "search_skills_hub",
            "description": "搜索在线技能市场（skills.sh）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "limit": {"type": "integer", "default": 10, "description": "最大结果数"}
                },
                "required": ["query"]
            }
        },
        {
            "name": "install_skill_hub",
            "description": "从在线市场安装技能到本地",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "技能名称（如 python-debug）"},
                    "source": {"type": "string", "description": "来源 URL 或市场名称（默认 skills.sh）"}
                },
                "required": ["name"]
            }
        },
        # ---- Phase 3: MCP 网关管理 ----
        {
            "name": "add_mcp_server",
            "description": "添加外部 MCP 服务器（自动发现工具并聚合）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "服务器名称（英文，如 github）"},
                    "url": {"type": "string", "description": "MCP 服务器 URL（如 http://localhost:3001/mcp）"},
                    "prefix": {"type": "string", "description": "工具名前缀（默认 mcp_{name}_）"}
                },
                "required": ["name", "url"]
            }
        },
        {
            "name": "remove_mcp_server",
            "description": "移除外部 MCP 服务器",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "服务器名称"}
                },
                "required": ["name"]
            }
        },
        {
            "name": "list_mcp_servers",
            "description": "列出所有已连接的外部 MCP 服务器",
            "inputSchema": {
                "type": "object",
                "properties": {},
            }
        },
        {
            "name": "refresh_mcp_servers",
            "description": "刷新所有外部 MCP 服务器的工具列表",
            "inputSchema": {
                "type": "object",
                "properties": {},
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
    from backend.services.mcp_client_service import mcp_client_service

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
        # 传递当前可用工具列表用于条件激活
        try:
            all_tools = _get_tools()
            available_tool_names = [t["name"] for t in all_tools]
            result = hermes_service.list_skills(available_tool_names)
        except Exception:
            result = hermes_service.list_skills()
    
        if not result:
            return "当前没有可用技能。使用 create_skill 创建新技能。"
        output = [f"可用技能 ({len(result)} 个)\n{'='*50}"]
        for s in result:
            desc = s.get("description", "无描述")
            tags = ", ".join(s.get("tags", []))
            line = f"  {s['name']}"
            if desc:
                line += f" - {desc[:60]}"
            if tags:
                line += f" [{tags}]"
            output.append(line)
        return "\n".join(output)

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
            f"- 版本: {os.environ.get('APP_VERSION', '3.2.0')}"
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
            raise ValueError(f"❌ 文件不存在: {fpath}\n建议：\n1. 使用 list_directory 工具查看目标目录下的文件列表，确认路径是否正确\n2. 检查路径拼写，注意大小写和斜杠方向（使用 / 而非 \\）\n3. 如果是相对路径，尝试使用绝对路径")
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            total = len(lines)
            selected = lines[offset:offset + limit]
            content = "".join(selected)
            header = f"文件: {fpath}\n总行数: {total}\n显示: 第 {offset+1}-{min(offset+limit, total)} 行\n{'='*50}\n"
            return header + content
        except Exception as e:
            raise ValueError(f"❌ 读取文件失败: {e}\n建议：\n1. 检查文件编码是否为 UTF-8，如果是二进制文件（如图片、压缩包）则无法以文本方式读取\n2. 确认当前用户对该文件有读取权限（使用 ls -la 检查）\n3. 如果文件被其他进程锁定，请等待后重试")

    elif name == "write_file":
        import os as _os
        fpath = arguments.get("path", "")
        content = arguments.get("content", "")
        if not fpath:
            raise ValueError("❌ 请提供文件路径\n建议：\n1. 在参数 path 中指定要写入的文件完整路径\n2. 路径示例：'/workspace/myproject/config.json'\n3. 如果目录不存在，write_file 会自动创建中间目录")
        try:
            _os.makedirs(_os.path.dirname(fpath), exist_ok=True)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            return f"文件已写入: {fpath} ({len(content)} 字符)"
        except Exception as e:
            raise ValueError(f"❌ 写入文件失败: {e}\n建议：\n1. 检查目标目录的写入权限（使用 ls -la 确认当前用户是否有写权限）\n2. 确认磁盘空间充足（使用 df -h 检查）\n3. 如果目标路径是系统目录或受保护路径，请选择其他位置")

    elif name == "list_directory":
        import os as _os
        dpath = arguments.get("path", "")
        pattern = arguments.get("pattern", "")
        if not _os.path.isdir(dpath):
            raise ValueError(f"❌ 目录不存在: {dpath}\n建议：\n1. 使用 list_directory 工具查看父目录，确认路径拼写是否正确\n2. 检查路径中每一级目录是否都存在\n3. 如果需要创建目录，请先使用 shell_execute 执行 mkdir -p 命令")
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
            raise ValueError(f"❌ 列出目录失败: {e}\n建议：\n1. 检查当前用户对该目录是否有读取和执行权限（使用 ls -la 确认）\n2. 如果是挂载目录或网络目录，确认挂载状态正常\n3. 尝试使用 shell_execute 执行 ls 命令获取更多信息")

    elif name == "search_files":
        import os as _os
        root = arguments.get("path", "")
        pattern = arguments.get("pattern", "")
        file_pattern = arguments.get("file_pattern", "")
        max_results = int(arguments.get("max_results", 20))
        if not _os.path.isdir(root):
            raise ValueError(f"❌ 目录不存在: {root}\n建议：\n1. 使用 list_directory 工具确认父目录路径是否正确\n2. 检查路径拼写，注意大小写敏感性\n3. 如果目录尚未创建，请先通过 shell_execute 执行 mkdir -p 创建")
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
            raise ValueError(f"❌ 搜索失败: {e}\n建议：\n1. 缩小搜索范围，指定更精确的 path 参数或使用 file_pattern 限制文件类型\n2. 检查正则表达式语法是否正确（pattern 参数使用正则语法）\n3. 如果目录文件过多，尝试降低 max_results 或缩小搜索目录")

    # ---- Phase 1: 终端执行工具 ----
    elif name == "shell_execute":
        import subprocess as _subprocess
        import os as _os
        command = arguments.get("command", "")
        timeout = min(int(arguments.get("timeout", 30)), 120)
        cwd = arguments.get("cwd", "")
        if not command:
            raise ValueError("❌ 请提供命令\n建议：\n1. 在参数 command 中输入要执行的终端命令\n2. 命令示例：'ls -la /workspace' 或 'python script.py'\n3. 可选参数 timeout 控制超时秒数（默认 30 秒，最大 120 秒），cwd 指定工作目录")
        try:
            actual_cwd = cwd or _os.getcwd()
            result = _subprocess.run(
                command, shell=True, capture_output=True, text=True,
                timeout=timeout, cwd=actual_cwd,
                env={**_subprocess.os.environ, "PAGER": "cat"}
            )
            output = result.stdout or ""
            error = result.stderr or ""
            exit_code = result.returncode

            # 截断过长输出
            max_output = 10000
            truncated_output = False
            truncated_error = False
            if len(output) > max_output:
                output = output[:max_output]
                truncated_output = True
            if len(error) > max_output:
                error = error[:max_output]
                truncated_error = True

            # 构建输出部分
            parts = [f"命令: {command}"]
            parts.append(f"工作目录: {actual_cwd}")
            parts.append(f"退出码: {exit_code}")

            if output:
                # 长输出格式化
                output_lines = output.split("\n")
                total_lines = len(output_lines)
                if total_lines > 500:
                    display_lines = output_lines[:500]
                    output = "\n".join(display_lines)
                    output += f"\n\n... (共 {total_lines} 行，显示第 1-500 行)"
                parts.append(f"\n--- stdout ---\n{output}")
                if truncated_output:
                    parts.append(f"\n[输出已截断，原始 stdout 共 {len(result.stdout)} 字符]")

            if error:
                parts.append(f"\n--- stderr ---\n{error}")
                if truncated_error:
                    parts.append(f"\n[错误已截断，原始 stderr 共 {len(result.stderr)} 字符]")

            # 错误信息增强
            if exit_code == 127:
                # 命令不存在
                cmd_name = command.strip().split()[0] if command.strip() else "未知"
                parts.append(f"\n⚠️ 命令 '{cmd_name}' 不存在")
                parts.append("建议：")
                parts.append(f"1. 检查命令拼写是否正确（常见拼写错误：'sl' → 'ls'，'cd..' → 'cd ..'）")
                parts.append(f"2. 使用 'which {cmd_name}' 或 'command -v {cmd_name}' 确认命令是否已安装")
                parts.append(f"3. 如果需要安装，尝试：apt install {cmd_name} / brew install {cmd_name} / pip install {cmd_name}")
                parts.append(f"4. 如果是 Python 包，尝试：pip install $(echo {cmd_name} | tr '-' '_')")
            elif exit_code == 126:
                # 权限不足
                parts.append("\n⚠️ 权限不足，无法执行命令")
                parts.append("建议：")
                parts.append("1. 使用 sudo 重新执行命令（如 sudo apt update）")
                parts.append("2. 检查文件权限：ls -la <命令路径>")
                parts.append("3. 如果是脚本文件，添加执行权限：chmod +x <文件路径>")
                parts.append("4. 确认当前用户是否在正确的用户组中")
            elif exit_code != 0:
                # 其他非零退出码
                parts.append(f"\n⚠️ 命令执行失败（退出码 {exit_code}）")
                if error:
                    # 提取关键错误信息
                    error_lines = [l.strip() for l in error.strip().split("\n") if l.strip()]
                    if error_lines:
                        parts.append(f"错误摘要: {error_lines[-1]}")
                parts.append("建议：")
                parts.append("1. 检查命令参数是否正确")
                parts.append("2. 查看上方 stderr 输出中的详细错误信息")
                parts.append("3. 尝试使用 --help 或 -h 查看命令帮助")
                parts.append("4. 如果是编译/构建错误，检查依赖是否完整安装")

            return "\n".join(parts)
        except _subprocess.TimeoutExpired:
            raise ValueError(f"❌ 命令执行超时（{timeout}秒）\n建议：\n1. 将命令拆分为多个较短的子命令分步执行\n2. 增加 timeout 参数值（最大支持 120 秒）\n3. 如果是长时间运行的任务，考虑使用 nohup 或 screen 在后台执行")
        except Exception as e:
            raise ValueError(f"❌ 命令执行失败: {e}\n建议：\n1. 检查命令语法是否正确，尤其是引号、管道符和分号的使用\n2. 确认命令所需的依赖和程序已安装（使用 which 或 command -v 检查）\n3. 查看 stderr 输出中的具体错误信息以定位问题")

    # ---- Phase 1: Web 搜索工具 ----
    elif name == "web_search":
        query = arguments.get("query", "")
        max_results = int(arguments.get("max_results", 5))
        if not query:
            raise ValueError("❌ 请提供搜索关键词\n建议：\n1. 在参数 query 中输入要搜索的关键词或问题\n2. 关键词示例：'Python asyncio 教程' 或 'Docker 容器网络配置'\n3. 可选参数 max_results 控制返回结果数量（默认 5 条）")
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
                raise ValueError(f"❌ 搜索失败: {e}\n建议：\n1. 尝试使用英文关键词重新搜索，可能获得更多结果\n2. 简化关键词，避免过于复杂的查询\n3. 如果持续失败，可能是网络连接问题，请检查网络状态")

    elif name == "web_fetch":
        url = arguments.get("url", "")
        max_length = int(arguments.get("max_length", 5000))
        if not url:
            raise ValueError("❌ 请提供 URL\n建议：\n1. 在参数 url 中输入完整的网页地址\n2. URL 示例：'https://docs.python.org/3/' 或 'https://github.com/user/repo'\n3. 确保 URL 以 http:// 或 https:// 开头")
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
            raise ValueError(f"❌ 抓取网页失败: {e}\n建议：\n1. 检查 URL 是否正确且可访问（在浏览器中打开确认）\n2. 某些网站可能拒绝非浏览器请求，尝试其他网站\n3. 检查网络连接是否正常，确认目标服务器未宕机")

    # ---- Phase 2: 全文搜索工具 ----
    elif name == "search_messages":
        query = arguments.get("query", "")
        session_id = arguments.get("session_id")
        limit = int(arguments.get("limit", 20))
        if not query:
            raise ValueError("❌ 请提供搜索关键词\n建议：\n1. 在参数 query 中输入要搜索的消息内容关键词\n2. 关键词示例：'函数定义' 或 '错误处理'\n3. 可选参数 session_id 可限定搜索范围到特定会话")
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
            raise ValueError(f"❌ 搜索失败: {e}\n建议：\n1. 检查搜索关键词是否过于宽泛或包含特殊字符\n2. 确认 Hermes 服务正常运行，数据库连接正常\n3. 尝试使用更具体的关键词缩小搜索范围")

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
            raise ValueError(f"❌ 读取 SOUL.md 失败: {e}\n建议：\n1. 检查 Hermes 主目录是否存在且可访问\n2. 如果 SOUL.md 尚未创建，请使用 write_soul 工具创建 Agent 人格定义\n3. 确认文件编码为 UTF-8")

    elif name == "write_soul":
        content = arguments.get("content", "")
        if not content:
            raise ValueError("❌ 请提供人格定义内容\n建议：\n1. 在参数 content 中输入 Agent 的人格定义文本（Markdown 格式）\n2. 内容示例：'你是专业的编程助手，擅长 Python 和 JavaScript'\n3. 可以包含角色设定、行为准则、知识领域等描述")
        try:
            from backend.config import get_hermes_home
            soul_path = get_hermes_home() / "SOUL.md"
            soul_path.parent.mkdir(parents=True, exist_ok=True)
            soul_path.write_text(content, encoding="utf-8")
            return f"SOUL.md 已更新 ({len(content)} 字符)"
        except Exception as e:
            raise ValueError(f"❌ 写入 SOUL.md 失败: {e}\n建议：\n1. 检查 Hermes 主目录的写入权限\n2. 确认磁盘空间充足\n3. 如果文件被其他进程占用，请稍后重试")

    # ---- AGENTS.md 支持 ----
    elif name == "read_agents_md":
        import os as _os
        custom_path = arguments.get("path", "")
        if custom_path:
            if not _os.path.isfile(custom_path):
                raise ValueError(f"❌ 文件不存在: {custom_path}\n建议：\n1. 检查路径拼写是否正确\n2. 使用 list_directory 确认文件位置")
            try:
                with open(custom_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                return f"AGENTS.md ({custom_path}, {len(content)} 字符)\n{'='*50}\n{content}"
            except Exception as e:
                raise ValueError(f"❌ 读取文件失败: {e}")
        else:
            # 按顺序查找：./AGENTS.md → ./CLAUDE.md → ~/.hermes/AGENTS.md
            search_paths = [
                ("./AGENTS.md", "AGENTS.md"),
                ("./CLAUDE.md", "CLAUDE.md"),
            ]
            try:
                from backend.config import get_hermes_home
                hermes_home = get_hermes_home()
                search_paths.append((str(hermes_home / "AGENTS.md"), "~/.hermes/AGENTS.md"))
            except Exception:
                pass

            for fpath, label in search_paths:
                if _os.path.isfile(fpath):
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()
                        return f"{label} ({fpath}, {len(content)} 字符)\n{'='*50}\n{content}"
                    except Exception as e:
                        raise ValueError(f"❌ 读取 {label} 失败: {e}")

            return "未找到 AGENTS.md，使用 write_agents_md 创建。\n\n查找路径（按顺序）：\n1. ./AGENTS.md\n2. ./CLAUDE.md\n3. ~/.hermes/AGENTS.md"

    elif name == "write_agents_md":
        import os as _os
        content = arguments.get("content", "")
        if not content:
            raise ValueError("❌ 请提供项目指令内容\n建议：\n1. 在参数 content 中输入项目级指令文本（Markdown 格式）\n2. 内容示例：编码规范、项目结构说明、常用命令等\n3. 可选参数 path 指定写入路径（默认 ~/.hermes/AGENTS.md）")
        custom_path = arguments.get("path", "")
        if custom_path:
            target_path = custom_path
        else:
            try:
                from backend.config import get_hermes_home
                target_path = str(get_hermes_home() / "AGENTS.md")
            except Exception:
                target_path = _os.path.expanduser("~/.hermes/AGENTS.md")
        try:
            _os.makedirs(_os.path.dirname(target_path), exist_ok=True)
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(content)
            return f"AGENTS.md 已写入: {target_path} ({len(content)} 字符)"
        except Exception as e:
            raise ValueError(f"❌ 写入 AGENTS.md 失败: {e}\n建议：\n1. 检查目标目录的写入权限\n2. 确认磁盘空间充足\n3. 尝试使用 path 参数指定其他写入路径")

    # ---- 学习循环 ----
    elif name == "read_learnings":
        import os as _os
        try:
            from backend.config import get_hermes_home
            learnings_path = get_hermes_home() / "learnings.md"
        except Exception:
            learnings_path = _os.path.expanduser("~/.hermes/learnings.md")

        if not _os.path.isfile(learnings_path):
            return "暂无学习记录。使用 add_learning 工具记录工具使用中的发现和经验。"

        try:
            with open(learnings_path, "r", encoding="utf-8", errors="replace") as f:
                full_content = f.read()
            if not full_content.strip():
                return "暂无学习记录。使用 add_learning 工具记录工具使用中的发现和经验。"

            # 按条目分割（## 开头为条目分隔符）
            entries = []
            current_entry = []
            for line in full_content.split("\n"):
                if line.startswith("## ") and current_entry:
                    entries.append("\n".join(current_entry))
                    current_entry = [line]
                else:
                    current_entry.append(line)
            if current_entry:
                entries.append("\n".join(current_entry))

            # 按时间倒序（最新在前）
            entries = entries[::-1]
            limit = int(arguments.get("limit", 20))
            selected = entries[:limit]

            header = f"学习记录 (共 {len(entries)} 条，显示最近 {len(selected)} 条)\n{'='*50}\n"
            return header + "\n---\n".join(selected)
        except Exception as e:
            raise ValueError(f"❌ 读取学习记录失败: {e}")

    elif name == "add_learning":
        import os as _os
        from datetime import datetime, timezone
        content = arguments.get("content", "")
        if not content:
            raise ValueError("❌ 请提供学习内容\n建议：\n1. 在参数 content 中输入本次学习或发现的描述\n2. 可选参数 tool 指定相关工具名\n3. 可选参数 error 记录相关错误信息")
        tool_name = arguments.get("tool", "")
        error_info = arguments.get("error", "")

        try:
            from backend.config import get_hermes_home
            learnings_path = get_hermes_home() / "learnings.md"
        except Exception:
            learnings_path = _os.path.expanduser("~/.hermes/learnings.md")

        try:
            _os.makedirs(_os.path.dirname(learnings_path), exist_ok=True)

            # 构建新条目
            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            entry_lines = [f"\n## [{now}] {tool_name}"]
            entry_lines.append(f"- **内容**: {content}")
            if tool_name:
                entry_lines.append(f"- **工具**: {tool_name}")
            if error_info:
                entry_lines.append(f"- **错误**: {error_info}")
            new_entry = "\n".join(entry_lines) + "\n"

            # 读取现有内容并检查条数
            existing = ""
            if _os.path.isfile(learnings_path):
                with open(learnings_path, "r", encoding="utf-8", errors="replace") as f:
                    existing = f.read()

            # 计算现有条数
            entry_count = existing.count("\n## ")

            # 超过 50 条时删除最旧的条目
            if entry_count >= 50:
                # 找到第一个条目（最旧的）并删除
                first_entry_end = existing.find("\n## ", 1)
                if first_entry_end != -1:
                    existing = existing[first_entry_end:]
                else:
                    existing = ""

            # 写入
            with open(learnings_path, "w", encoding="utf-8") as f:
                f.write(existing + new_entry)

            return f"学习记录已添加 ({tool_name or '通用'})"
        except Exception as e:
            raise ValueError(f"❌ 添加学习记录失败: {e}\n建议：\n1. 检查 ~/.hermes/ 目录的写入权限\n2. 确认磁盘空间充足\n3. 如果 learnings.md 文件损坏，可手动删除后重试")

    elif name == "compress_session":
        session_id = arguments.get("session_id", "")
        if not session_id:
            raise ValueError("❌ 请提供会话 ID。\n建议：\n1. 使用 list_sessions 获取会话 ID\n2. 确认 session_id 参数拼写正确")
        keep_recent = int(arguments.get("keep_recent", 3))
        keep_first = int(arguments.get("keep_first", 1))
        summary_max = int(arguments.get("summary_max_chars", 500))

        # 从 hermes_service 获取消息
        messages = hermes_service.get_session_messages(session_id)
        if not messages:
            raise ValueError(f"❌ 会话 {session_id} 没有消息。\n建议：\n1. 确认会话 ID 正确\n2. 使用 list_sessions 查看可用会话")

        total = len(messages)
        if total <= (keep_recent + keep_first):
            return f"会话只有 {total} 条消息，无需压缩（阈值: {keep_recent + keep_first}）"

        # 保留最早 N 条
        first_msgs = messages[:keep_first]
        # 保留最近 N 条
        recent_msgs = messages[-keep_recent:]
        # 中间部分生成摘要
        middle_msgs = messages[keep_first:-keep_recent]

        # 简单摘要：提取每条消息的前 50 字符
        summary_parts = []
        for m in middle_msgs:
            role = m.get("role", "?")
            content = m.get("content", "")
            preview = content[:80].replace("\n", " ")
            summary_parts.append(f"[{role}] {preview}")

        summary = " | ".join(summary_parts)
        if len(summary) > summary_max:
            summary = summary[:summary_max] + "..."

        # 计算压缩率
        original_chars = sum(len(m.get("content", "")) for m in messages)
        compressed_chars = sum(len(m.get("content", "")) for m in first_msgs) + len(summary) + sum(len(m.get("content", "")) for m in recent_msgs)
        ratio = (1 - compressed_chars / max(original_chars, 1)) * 100

        # 保存摘要到会话元数据（通过 hermes_service）
        try:
            hermes_service.update_session_summary(session_id, summary)
        except Exception:
            pass  # 如果方法不存在，跳过

        return f"""会话压缩完成
原始: {total} 条消息 ({original_chars} 字符)
压缩后: {keep_first} + 摘要 + {keep_recent} 条 ({compressed_chars} 字符)
压缩率: {ratio:.1f}%

--- 最早 {keep_first} 条 ---
""" + "\n".join(f"[{m.get('role','?')}] {m.get('content','')[:100]}" for m in first_msgs) + f"""

--- 摘要 ({len(middle_msgs)} 条) ---
{summary}

--- 最近 {keep_recent} 条 ---
""" + "\n".join(f"[{m.get('role','?')}] {m.get('content','')[:100]}" for m in recent_msgs)

    elif name == "suggest_skill":
        session_id = arguments.get("session_id", "")
        min_calls = int(arguments.get("min_calls", 3))

        # 获取会话列表
        sessions = hermes_service.list_sessions()
        if not sessions:
            return "暂无会话数据，无法分析工具调用模式。"

        # 使用指定会话或最近会话
        target_id = session_id or sessions[0].get("id", "")
        messages = hermes_service.get_session_messages(target_id)
        if not messages:
            return f"会话 {target_id} 没有消息。"

        # 分析工具调用模式（从消息中提取 tool_call 模式）
        tool_pattern = {}
        for msg in messages:
            content = msg.get("content", "")
            # 简单匹配工具调用模式
            tool_calls = re.findall(r'(?:调用|使用|执行)\s*(\w+)', content)
            for t in tool_calls:
                tool_pattern[t] = tool_pattern.get(t, 0) + 1

        # 也从 eval_service 获取真实调用数据
        try:
            from backend.services.eval_service import eval_service
            tool_stats = eval_service.get_tool_stats()
            for stat in tool_stats:
                tool_name = stat.get("tool", "")
                count = stat.get("calls", 0)
                if count >= min_calls:
                    tool_pattern[tool_name] = max(tool_pattern.get(tool_name, 0), count)
        except Exception:
            pass

        if not tool_pattern:
            return "未发现重复的工具调用模式。建议：\n1. 多使用工具后再次分析\n2. 降低 min_calls 阈值"

        # 生成技能建议
        suggestions = []
        for tool, count in sorted(tool_pattern.items(), key=lambda x: -x[1]):
            if count >= min_calls:
                suggestions.append(f"  - {tool}: 调用 {count} 次")

        if not suggestions:
            return f"未发现调用次数 >= {min_calls} 的工具模式。当前模式：\n" + "\n".join(f"  - {t}: {c} 次" for t, c in sorted(tool_pattern.items(), key=lambda x: -x[1])[:5])

        # 生成技能草案
        skill_name = f"auto-{target_id[:8]}"
        draft = f"""# 建议技能: {skill_name}

## 触发条件
以下工具被频繁调用：
{chr(10).join(suggestions)}

## 建议操作
1. 审查上述工具调用是否构成可复用工作流
2. 如果是，使用 create_skill 创建技能
3. 技能内容应包含：触发条件、执行步骤、预期输出

## 草案内容
```markdown
# {skill_name}
## 描述
自动生成的技能（基于会话 {target_id[:12]} 的工具调用模式）

## 触发条件
当需要频繁使用以下工具时激活：
{chr(10).join(suggestions)}

## 执行步骤
1. 按照工具调用顺序执行
2. 检查每步输出是否符合预期
3. 记录结果到学习记录
```

使用 create_skill 创建此技能，或调整内容后创建。"""

        return draft

    elif name == "search_skills_hub":
        query = arguments.get("query", "")
        if not query:
            raise ValueError("❌ 请提供搜索关键词。\n建议：\n1. 使用英文关键词效果更好\n2. 尝试具体技能名如 'python'、'git'、'docker'")
        limit = int(arguments.get("limit", 10))

        try:
            import urllib.request
            url = f"https://skills.sh/api/search?q={urllib.parse.quote(query)}&limit={limit}"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            if not data:
                return f"未找到匹配 '{query}' 的技能。建议：\n1. 尝试更通用的关键词\n2. 检查网络连接"

            output = [f"搜索: {query} | 找到 {len(data)} 个技能\n{'='*50}"]
            for skill in data[:limit]:
                name = skill.get("name", "?")
                desc = skill.get("description", "无描述")[:80]
                author = skill.get("author", "")
                installs = skill.get("installs", 0)
                output.append(f"  {name} (by {author}, {installs} 安装)")
                output.append(f"    {desc}")

            return "\n".join(output)
        except Exception as e:
            # 降级：返回内置技能列表
            skills = hermes_service.list_skills()
            matched = [s for s in skills if query.lower() in s.get("name", "").lower() or query.lower() in s.get("description", "").lower()]
            if matched:
                output = [f"在线搜索不可用，显示本地匹配结果 ({len(matched)} 个)\n{'='*50}"]
                for s in matched:
                    output.append(f"  {s['name']}: {s.get('description', '无描述')[:80]}")
                return "\n".join(output)
            raise ValueError(f"❌ 搜索失败: {e}\n建议：\n1. 检查网络连接\n2. 稍后重试")

    elif name == "install_skill_hub":
        skill_name = arguments.get("name", "")
        if not skill_name:
            raise ValueError("❌ 请提供技能名称。\n建议：\n1. 先用 search_skills_hub 搜索\n2. 使用技能的精确名称")
        source = arguments.get("source", "")

        try:
            import urllib.request
            if not source:
                source = f"https://skills.sh/api/skills/{urllib.parse.quote(skill_name)}"

            req = urllib.request.Request(source, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            content = data.get("content", "")
            if not content:
                raise ValueError(f"技能 '{skill_name}' 内容为空")

            # 使用 hermes_service 创建技能
            desc = data.get("description", f"从市场安装: {skill_name}")
            tags = data.get("tags", ["hub"])
            result = hermes_service.create_skill(skill_name, content, desc, tags)

            if result.get("success"):
                return f"技能 '{skill_name}' 安装成功！\n描述: {desc}\n标签: {', '.join(tags)}\n使用 get_skill_content('{skill_name}') 查看内容"
            else:
                raise ValueError(f"❌ 安装失败: {result.get('message', '未知错误')}\n建议：\n1. 技能可能已存在，使用 update_skill 更新\n2. 检查技能名称")
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"❌ 安装失败: {e}\n建议：\n1. 检查网络连接\n2. 确认技能名称正确\n3. 使用 search_skills_hub 先搜索")

    # ---- Phase 3: MCP 网关管理 ----
    elif name == "add_mcp_server":
        server_name = arguments.get("name", "")
        url = arguments.get("url", "")
        prefix = arguments.get("prefix", "")
        result = mcp_client_service.add_server(server_name, url, prefix)
        if not result.get("success"):
            raise ValueError(f"❌ {result.get('message', '添加失败')}\n建议：\n1. 检查服务器名称是否已存在（使用 list_mcp_servers 查看已添加的服务器）\n2. 确认 URL 格式正确且服务器可访问\n3. 检查服务器名称和 URL 是否拼写正确")
        return f"已添加 MCP 服务器 '{server_name}'，发现 {result.get('tools_count', 0)} 个工具（前缀: {mcp_client_service._servers[server_name].get('prefix', '')}）"

    elif name == "remove_mcp_server":
        server_name = arguments.get("name", "")
        result = mcp_client_service.remove_server(server_name)
        if not result.get("success"):
            raise ValueError(f"❌ {result.get('message', '移除失败')}\n建议：\n1. 使用 list_mcp_servers 确认服务器名称是否正确\n2. 确认该服务器当前处于已连接状态\n3. 服务器名称区分大小写，请检查拼写")
        return f"已移除 MCP 服务器 '{server_name}'"

    elif name == "list_mcp_servers":
        servers = mcp_client_service.list_servers()
        if not servers:
            return "当前没有连接外部 MCP 服务器。使用 add_mcp_server 添加。"
        output = [f"已连接 {len(servers)} 个外部 MCP 服务器\n{'='*50}"]
        for s in servers:
            output.append(f"  {s['name']} ({s['status']})")
            output.append(f"    URL: {s['url']}")
            output.append(f"    工具: {s['tools_count']} 个")
            output.append(f"    前缀: {s['prefix']}")
            if s.get("last_check"):
                output.append(f"    最后检查: {s['last_check']}")
        return "\n".join(output)

    elif name == "refresh_mcp_servers":
        result = mcp_client_service.refresh_all()
        return result.get("message", "刷新完成")

    # ---- Phase 3: 外部 MCP 工具路由 ----
    elif mcp_client_service.is_external_tool(name):
        try:
            result = mcp_client_service.call_external_tool(name, arguments)
            # 解析 MCP 响应
            if isinstance(result, dict):
                if "error" in result:
                    raise ValueError(f"❌ {result['error']}\n建议：\n1. 使用 refresh_mcp_servers 工具刷新外部服务器连接状态\n2. 检查外部 MCP 服务器是否正常运行\n3. 确认网络连接正常，服务器地址可访问")
                content_list = result.get("result", {}).get("content", [])
                if content_list:
                    return "\n".join(c.get("text", "") for c in content_list)
                return json.dumps(result.get("result", {}), ensure_ascii=False, indent=2)
            return str(result)
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"❌ 调用外部工具 '{name}' 失败: {e}\n建议：\n1. 使用 refresh_mcp_servers 刷新服务器连接后重试\n2. 检查传递给工具的参数是否符合要求\n3. 确认外部 MCP 服务器正在运行且网络可达")

    else:
        raise ValueError(f"❌ 未知工具: {name}\n建议：\n1. 使用 list_tools 工具查看所有可用的内置工具列表\n2. 如果要使用外部 MCP 工具，请先通过 add_mcp_server 添加对应服务器\n3. 检查工具名称拼写是否正确，注意大小写")


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

            # 工具调用追踪
            from backend.services import eval_service
            start = time.time()
            try:
                result_text = await _call_tool(tool_name, arguments)
                latency = int((time.time() - start) * 1000)
                eval_service.record_tool_call(tool_name, arguments, True, latency, "", "mcp")
                return JSONResponse(content=_jsonrpc_response(req_id, {
                    "content": [{"type": "text", "text": result_text}]
                }))
            except Exception as e:
                latency = int((time.time() - start) * 1000)
                eval_service.record_tool_call(tool_name, arguments, False, latency, str(e), "mcp")
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
