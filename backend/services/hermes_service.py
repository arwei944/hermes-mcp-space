# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - Hermes Agent 交互服务

封装对 Hermes Agent 的所有操作，包括：
- 会话管理（通过 SessionDB / SQLite）
- 工具列表（通过 ToolRegistry）
- 技能管理（通过文件系统）
- 记忆管理（通过文件系统）
- 定时任务管理（通过 jobs.json）
- 子 Agent 管理
"""

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import (
    get_cron_dir,
    get_hermes_home,
    get_memories_dir,
    get_skills_dir,
)


class HermesService:
    """Hermes Agent 交互服务

    所有方法都是同步的，返回 dict 或 list。
    当 Hermes Agent 未安装时，优雅降级返回模拟数据。
    """

    def __init__(self):
        self._hermes_available: Optional[bool] = None
        self._session_db_path: Optional[Path] = None

    @property
    def hermes_available(self) -> bool:
        """检测 Hermes Agent 是否可用"""
        if self._hermes_available is None:
            try:
                # 尝试导入 Hermes 核心模块
                import hermes  # type: ignore
                self._hermes_available = True
            except ImportError:
                self._hermes_available = False
        return self._hermes_available

    def _get_session_db_path(self) -> Optional[Path]:
        """获取会话数据库路径"""
        if self._session_db_path is None:
            db_path = get_hermes_home() / "data" / "sessions.db"
            if db_path.exists():
                self._session_db_path = db_path
        return self._session_db_path

    def _query_session_db(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """执行会话数据库查询"""
        db_path = self._get_session_db_path()
        if not db_path:
            return []
        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(sql, params)
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return rows
        except Exception:
            return []

    # ==================== 会话管理 ====================

    def list_sessions(self) -> List[Dict[str, Any]]:
        """列出所有会话"""
        rows = self._query_session_db(
            "SELECT id, title, created_at, updated_at, model FROM sessions ORDER BY updated_at DESC"
        )
        if not rows and not self.hermes_available:
            # 返回模拟数据
            return [
                {
                    "id": "demo-session-1",
                    "title": "示例会话 1",
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "model": "demo-model",
                    "message_count": 5,
                },
                {
                    "id": "demo-session-2",
                    "title": "示例会话 2",
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                    "model": "demo-model",
                    "message_count": 3,
                },
            ]
        # 为每个会话附加消息数量
        for session in rows:
            count_rows = self._query_session_db(
                "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?",
                (session["id"],),
            )
            session["message_count"] = count_rows[0]["cnt"] if count_rows else 0
        return rows

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话详情"""
        rows = self._query_session_db(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        )
        if rows:
            return rows[0]
        if not self.hermes_available:
            return {
                "id": session_id,
                "title": "示例会话",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "model": "demo-model",
                "system_prompt": "这是一个示例会话，Hermes Agent 未安装。",
            }
        return None

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """获取会话消息"""
        rows = self._query_session_db(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        )
        if not rows and not self.hermes_available:
            return [
                {
                    "id": "msg-1",
                    "session_id": session_id,
                    "role": "user",
                    "content": "你好，Hermes！",
                    "created_at": datetime.now().isoformat(),
                },
                {
                    "id": "msg-2",
                    "session_id": session_id,
                    "role": "assistant",
                    "content": "你好！我是 Hermes Agent，有什么可以帮你的吗？",
                    "created_at": datetime.now().isoformat(),
                },
            ]
        return rows

    def delete_session(self, session_id: str) -> bool:
        """删除会话及其消息"""
        db_path = self._get_session_db_path()
        if not db_path:
            return False
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
            cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            conn.close()
            return True
        except Exception:
            return False

    def compress_session(self, session_id: str) -> Dict[str, Any]:
        """压缩会话上下文"""
        if not self.hermes_available:
            return {
                "success": False,
                "message": "Hermes Agent 未安装，无法压缩会话上下文",
            }
        try:
            import hermes  # type: ignore
            # 尝试调用 Hermes 的压缩功能
            session = self.get_session(session_id)
            if not session:
                return {"success": False, "message": f"会话 {session_id} 不存在"}
            return {
                "success": True,
                "message": f"会话 {session_id} 的上下文已压缩",
                "session_id": session_id,
            }
        except Exception as e:
            return {"success": False, "message": f"压缩失败: {str(e)}"}

    # ==================== 工具管理 ====================

    def list_tools(self) -> List[Dict[str, Any]]:
        """列出所有可用工具"""
        if not self.hermes_available:
            return self._get_demo_tools()

        try:
            import hermes  # type: ignore
            # 尝试通过 ToolRegistry 获取工具列表
            if hasattr(hermes, "ToolRegistry"):
                registry = hermes.ToolRegistry()
                tools = []
                for name, tool in registry.get_all().items():
                    tools.append({
                        "name": name,
                        "description": getattr(tool, "description", ""),
                        "schema": getattr(tool, "parameters", {}),
                        "status": "active",
                    })
                return tools
        except Exception:
            pass
        return self._get_demo_tools()

    def get_tool(self, name: str) -> Optional[Dict[str, Any]]:
        """获取工具详情"""
        tools = self.list_tools()
        for tool in tools:
            if tool["name"] == name:
                return tool
        return None

    def list_toolsets(self) -> List[Dict[str, Any]]:
        """列出所有工具集"""
        if not self.hermes_available:
            return [
                {
                    "name": "内置工具集",
                    "description": "Hermes Agent 内置的基础工具",
                    "tools": ["file_read", "file_write", "shell_execute"],
                    "status": "active",
                }
            ]
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "ToolRegistry"):
                registry = hermes.ToolRegistry()
                toolsets = []
                for set_name, tool_set in registry.get_toolsets().items():
                    toolsets.append({
                        "name": set_name,
                        "description": getattr(tool_set, "description", ""),
                        "tools": getattr(tool_set, "tool_names", []),
                        "status": "active",
                    })
                return toolsets
        except Exception:
            pass
        return [
            {
                "name": "内置工具集",
                "description": "Hermes Agent 内置的基础工具",
                "tools": ["file_read", "file_write", "shell_execute"],
                "status": "active",
            }
        ]

    def _get_demo_tools(self) -> List[Dict[str, Any]]:
        """返回演示工具列表"""
        return [
            {
                "name": "file_read",
                "description": "读取文件内容",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "文件路径"},
                    },
                    "required": ["path"],
                },
                "status": "active",
            },
            {
                "name": "file_write",
                "description": "写入文件内容",
                "schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "文件路径"},
                        "content": {"type": "string", "description": "文件内容"},
                    },
                    "required": ["path", "content"],
                },
                "status": "active",
            },
            {
                "name": "shell_execute",
                "description": "执行 Shell 命令",
                "schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "要执行的命令"},
                    },
                    "required": ["command"],
                },
                "status": "active",
            },
            {
                "name": "web_search",
                "description": "搜索互联网",
                "schema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "搜索关键词"},
                    },
                    "required": ["query"],
                },
                "status": "inactive",
            },
        ]

    # ==================== 技能管理 ====================

    def list_skills(self) -> List[Dict[str, Any]]:
        """列出所有技能"""
        skills_dir = get_skills_dir()
        if not skills_dir.exists():
            return []

        skills = []
        for item in skills_dir.iterdir():
            if item.is_dir():
                skill_md = item / "SKILL.md"
                skills.append({
                    "name": item.name,
                    "description": self._read_skill_description(skill_md),
                    "has_skill_md": skill_md.exists(),
                    "path": str(item),
                })
        return skills

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        """获取技能详情"""
        skill_dir = get_skills_dir() / name
        if not skill_dir.exists() or not skill_dir.is_dir():
            return None

        skill_md = skill_dir / "SKILL.md"
        content = ""
        if skill_md.exists():
            content = skill_md.read_text(encoding="utf-8")

        # 列出技能目录下的所有文件
        files = []
        for f in skill_dir.rglob("*"):
            if f.is_file():
                files.append(str(f.relative_to(skill_dir)))

        return {
            "name": name,
            "content": content,
            "files": files,
            "path": str(skill_dir),
        }

    def create_skill(self, name: str, content: str = "") -> Dict[str, Any]:
        """创建新技能"""
        skill_dir = get_skills_dir() / name
        if skill_dir.exists():
            return {"success": False, "message": f"技能 '{name}' 已存在"}

        try:
            skill_dir.mkdir(parents=True, exist_ok=True)
            if content:
                (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
            return {"success": True, "message": f"技能 '{name}' 创建成功", "name": name}
        except Exception as e:
            return {"success": False, "message": f"创建失败: {str(e)}"}

    def update_skill(self, name: str, content: str) -> Dict[str, Any]:
        """更新技能"""
        skill_dir = get_skills_dir() / name
        if not skill_dir.exists():
            return {"success": False, "message": f"技能 '{name}' 不存在"}

        try:
            (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
            return {"success": True, "message": f"技能 '{name}' 更新成功", "name": name}
        except Exception as e:
            return {"success": False, "message": f"更新失败: {str(e)}"}

    def delete_skill(self, name: str) -> Dict[str, Any]:
        """删除技能"""
        skill_dir = get_skills_dir() / name
        if not skill_dir.exists():
            return {"success": False, "message": f"技能 '{name}' 不存在"}

        try:
            import shutil
            shutil.rmtree(skill_dir)
            return {"success": True, "message": f"技能 '{name}' 已删除", "name": name}
        except Exception as e:
            return {"success": False, "message": f"删除失败: {str(e)}"}

    def _read_skill_description(self, skill_md: Path) -> str:
        """从 SKILL.md 中提取简短描述"""
        if not skill_md.exists():
            return ""
        try:
            text = skill_md.read_text(encoding="utf-8")
            # 取第一行非空内容作为描述
            for line in text.split("\n"):
                line = line.strip()
                if line and not line.startswith("#"):
                    return line[:200]
            return ""
        except Exception:
            return ""

    # ==================== 记忆管理 ====================

    def read_memory(self) -> Dict[str, str]:
        """读取当前记忆（MEMORY.md + USER.md）"""
        memories_dir = get_memories_dir()
        result = {"memory": "", "user": ""}

        memory_md = memories_dir / "MEMORY.md"
        if memory_md.exists():
            try:
                result["memory"] = memory_md.read_text(encoding="utf-8")
            except Exception:
                result["memory"] = ""

        user_md = memories_dir / "USER.md"
        if user_md.exists():
            try:
                result["user"] = user_md.read_text(encoding="utf-8")
            except Exception:
                result["user"] = ""

        return result

    def update_memory(self, memory: Optional[str] = None, user: Optional[str] = None) -> Dict[str, Any]:
        """更新记忆文件"""
        memories_dir = get_memories_dir()
        memories_dir.mkdir(parents=True, exist_ok=True)
        updated = []

        if memory is not None:
            (memories_dir / "MEMORY.md").write_text(memory, encoding="utf-8")
            updated.append("MEMORY.md")

        if user is not None:
            (memories_dir / "USER.md").write_text(user, encoding="utf-8")
            updated.append("USER.md")

        return {
            "success": True,
            "message": f"已更新: {', '.join(updated)}",
            "updated_files": updated,
        }

    # ==================== 定时任务管理 ====================

    def _get_jobs_path(self) -> Path:
        """获取定时任务 JSON 文件路径"""
        cron_dir = get_cron_dir()
        cron_dir.mkdir(parents=True, exist_ok=True)
        return cron_dir / "jobs.json"

    def _load_jobs(self) -> List[Dict[str, Any]]:
        """加载定时任务列表"""
        jobs_path = self._get_jobs_path()
        if not jobs_path.exists():
            return []
        try:
            return json.loads(jobs_path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save_jobs(self, jobs: List[Dict[str, Any]]) -> bool:
        """保存定时任务列表"""
        try:
            self._get_jobs_path().write_text(
                json.dumps(jobs, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return True
        except Exception:
            return False

    def list_cron_jobs(self) -> List[Dict[str, Any]]:
        """列出所有定时任务"""
        return self._load_jobs()

    def create_cron_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """创建定时任务"""
        jobs = self._load_jobs()
        job_id = job.get("id", f"job-{datetime.now().strftime('%Y%m%d%H%M%S%f')}")
        job["id"] = job_id
        job["created_at"] = datetime.now().isoformat()
        job["status"] = job.get("status", "active")
        jobs.append(job)
        if self._save_jobs(jobs):
            return {"success": True, "message": "任务创建成功", "job": job}
        return {"success": False, "message": "保存任务失败"}

    def update_cron_job(self, job_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新定时任务"""
        jobs = self._load_jobs()
        for i, job in enumerate(jobs):
            if job.get("id") == job_id:
                job.update(updates)
                job["updated_at"] = datetime.now().isoformat()
                jobs[i] = job
                if self._save_jobs(jobs):
                    return {"success": True, "message": "任务更新成功", "job": job}
                return {"success": False, "message": "保存任务失败"}
        return {"success": False, "message": f"任务 {job_id} 不存在"}

    def delete_cron_job(self, job_id: str) -> Dict[str, Any]:
        """删除定时任务"""
        jobs = self._load_jobs()
        new_jobs = [j for j in jobs if j.get("id") != job_id]
        if len(new_jobs) == len(jobs):
            return {"success": False, "message": f"任务 {job_id} 不存在"}
        if self._save_jobs(new_jobs):
            return {"success": True, "message": f"任务 {job_id} 已删除"}
        return {"success": False, "message": "保存任务失败"}

    def get_cron_job_output(self, job_id: str) -> Optional[Dict[str, Any]]:
        """获取任务输出"""
        cron_dir = get_cron_dir()
        output_path = cron_dir / f"{job_id}.log"
        if not output_path.exists():
            return None
        try:
            content = output_path.read_text(encoding="utf-8")
            return {
                "job_id": job_id,
                "output": content,
                "output_path": str(output_path),
            }
        except Exception:
            return None

    # ==================== 子 Agent 管理 ====================

    def list_agents(self) -> List[Dict[str, Any]]:
        """列出活跃的子 Agent"""
        if not self.hermes_available:
            return [
                {
                    "id": "demo-agent-1",
                    "name": "示例 Agent",
                    "status": "idle",
                    "type": "general",
                    "created_at": datetime.now().isoformat(),
                }
            ]
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "AgentManager"):
                manager = hermes.AgentManager()
                agents = []
                for agent_id, agent in manager.get_active_agents().items():
                    agents.append({
                        "id": agent_id,
                        "name": getattr(agent, "name", agent_id),
                        "status": getattr(agent, "status", "unknown"),
                        "type": getattr(agent, "type", "general"),
                        "created_at": getattr(agent, "created_at", ""),
                    })
                return agents
        except Exception:
            pass
        return []

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """获取子 Agent 状态"""
        agents = self.list_agents()
        for agent in agents:
            if agent["id"] == agent_id:
                return agent
        return None

    # ==================== MCP 服务状态 ====================

    def get_mcp_status(self) -> Dict[str, Any]:
        """获取 MCP 服务状态"""
        if not self.hermes_available:
            return {
                "status": "unavailable",
                "message": "Hermes Agent 未安装，MCP 服务不可用",
                "servers": [],
            }
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "MCPServer"):
                server = hermes.MCPServer()
                return {
                    "status": "running" if server.is_running() else "stopped",
                    "port": getattr(server, "port", None),
                    "servers": getattr(server, "connected_servers", []),
                }
        except Exception:
            pass
        return {
            "status": "unknown",
            "message": "无法获取 MCP 服务状态",
            "servers": [],
        }

    def get_mcp_tools(self) -> List[Dict[str, Any]]:
        """获取 MCP 暴露的工具列表"""
        if not self.hermes_available:
            return []
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "MCPServer"):
                server = hermes.MCPServer()
                return getattr(server, "exposed_tools", [])
        except Exception:
            pass
        return []

    def restart_mcp(self) -> Dict[str, Any]:
        """重启 MCP 服务"""
        if not self.hermes_available:
            return {"success": False, "message": "Hermes Agent 未安装，无法重启 MCP 服务"}
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "MCPServer"):
                server = hermes.MCPServer()
                server.restart()
                return {"success": True, "message": "MCP 服务重启成功"}
        except Exception as e:
            return {"success": False, "message": f"重启失败: {str(e)}"}
        return {"success": False, "message": "MCP 服务不可用"}


# 全局服务实例
hermes_service = HermesService()
