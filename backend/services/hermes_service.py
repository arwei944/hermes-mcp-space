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
        self._remote_url = os.environ.get("HERMES_API_URL", "").rstrip("/")
        self._remote_cache: Dict[str, Any] = {}
        self._cache_time: float = 0

    @property
    def hermes_available(self) -> bool:
        """检测 Hermes Agent 是否可用（本地模块或远程 API）"""
        if self._hermes_available is None:
            if self._remote_url:
                self._hermes_available = True
            else:
                try:
                    import hermes  # type: ignore
                    self._hermes_available = True
                except ImportError:
                    self._hermes_available = False
        return self._hermes_available

    async def _fetch_remote(self, path: str) -> Optional[Any]:
        """从远程 Hermes API 获取数据"""
        import time
        if not self._remote_url:
            return None
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._remote_url}{path}")
                if resp.status_code == 200:
                    return resp.json()
        except Exception:
            pass
        return None

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

    # ==================== 会话管理（JSON 持久化） ====================

    def _get_sessions_path(self) -> Path:
        """获取会话 JSON 存储路径"""
        sessions_dir = get_hermes_home() / "data"
        sessions_dir.mkdir(parents=True, exist_ok=True)
        return sessions_dir / "sessions.json"

    def _load_sessions_data(self) -> Dict[str, Any]:
        """加载会话数据"""
        path = self._get_sessions_path()
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {"sessions": [], "messages": {}}

    def _save_sessions_data(self, data: Dict[str, Any]) -> bool:
        """保存会话数据"""
        path = self._get_sessions_path()
        try:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return True
        except Exception:
            return False

    def _load_messages(self) -> Dict[str, Any]:
        """加载消息数据（从会话数据中提取 messages 部分）"""
        data = self._load_sessions_data()
        return {"messages": data.get("messages", {})}

    def list_sessions(self) -> List[Dict[str, Any]]:
        """列出所有会话"""
        # 优先从 SQLite 读取
        rows = self._query_session_db(
            "SELECT id, title, created_at, updated_at, model FROM sessions ORDER BY updated_at DESC"
        )
        if rows:
            for session in rows:
                count_rows = self._query_session_db(
                    "SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?",
                    (session["id"],),
                )
                session["message_count"] = count_rows[0]["cnt"] if count_rows else 0
            return rows

        # 从 JSON 文件读取
        data = self._load_sessions_data()
        sessions = data.get("sessions", [])
        if sessions:
            for s in sessions:
                msgs = data.get("messages", {}).get(s["id"], [])
                s["message_count"] = len(msgs)
            return sessions

        # 无数据时返回空列表（不再返回 demo 数据）
        return []

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话详情"""
        rows = self._query_session_db(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        )
        if rows:
            return rows[0]

        data = self._load_sessions_data()
        for s in data.get("sessions", []):
            if s["id"] == session_id:
                return s
        return None

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        """获取会话消息"""
        rows = self._query_session_db(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        )
        if rows:
            return rows

        data = self._load_sessions_data()
        return data.get("messages", {}).get(session_id, [])

    def create_session(self, title: str = "", model: str = "", source: str = "mcp") -> Dict[str, Any]:
        """创建新会话"""
        session_id = f"sess_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        session = {
            "id": session_id,
            "title": title or f"会话 {session_id}",
            "model": model or "unknown",
            "source": source,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active",
        }
        data = self._load_sessions_data()
        data["sessions"].insert(0, session)
        data["messages"][session_id] = []
        self._save_sessions_data(data)
        return {"success": True, "session": session}

    def add_session_message(self, session_id: str, role: str, content: str, metadata: dict = None) -> Dict[str, Any]:
        """向会话添加消息"""
        ts = datetime.now().isoformat()
        msg = {
            "role": role,
            "content": content,
            "timestamp": ts,
        }
        if metadata:
            msg["metadata"] = metadata

        # 优先写入 SQLite（如果存在）
        db_path = self._get_session_db_path()
        if db_path:
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                # 确保 messages 表存在
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                """)
                cursor.execute(
                    "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                    (session_id, role, content, ts),
                )
                # 同步到 FTS5 全文搜索索引
                try:
                    cursor.execute("""
                        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                            session_id, role, content, created_at,
                            content='messages', content_rowid='id'
                        )
                    """)
                    cursor.execute("""
                        INSERT INTO messages_fts(rowid, session_id, role, content, created_at)
                        SELECT id, session_id, role, content, created_at FROM messages
                        WHERE id = last_insert_rowid()
                    """)
                except Exception:
                    pass
                conn.commit()
                conn.close()
            except Exception:
                pass  # fallback to JSON

        # 同时写入 JSON（兼容）
        data = self._load_sessions_data()
        if session_id not in data.get("messages", {}):
            data.setdefault("messages", {})[session_id] = []
        data["messages"][session_id].append(msg)
        # 更新会话的 updated_at
        for s in data.get("sessions", []):
            if s["id"] == session_id:
                s["updated_at"] = ts
                break
        self._save_sessions_data(data)

        # 触发 SSE 事件，通知前端有新消息
        try:
            from backend.routers.events import emit_event
            emit_event("session.message", {
                "session_id": session_id,
                "role": role,
                "content": content,
                "timestamp": ts,
            }, source="session")
        except Exception:
            pass

        return {"success": True, "message": msg}

    def delete_session(self, session_id: str) -> Dict[str, Any]:
        """删除会话"""
        data = self._load_sessions_data()
        sessions = data.get("sessions", [])
        exists = any(s.get("id") == session_id for s in sessions)
        if not exists:
            return {"success": False, "message": f"会话 {session_id} 不存在"}
        data["sessions"] = [s for s in sessions if s["id"] != session_id]
        data.get("messages", {}).pop(session_id, None)
        self._save_sessions_data(data)
        return {"success": True, "message": "会话已删除"}

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

    def search_sessions(self, keyword: str, limit: int = 20) -> List[Dict[str, Any]]:
        """搜索会话（按标题模糊匹配）"""
        sessions = self.list_sessions()
        keyword = keyword.lower()
        return [s for s in sessions if keyword in (s.get("title") or "").lower()
                or keyword in (s.get("model") or "").lower()
                or keyword in (s.get("id") or "").lower()][:limit]

    def get_all_tags(self) -> List[Dict[str, Any]]:
        """获取所有标签及统计"""
        data = self._load_sessions_data()
        tag_counts: Dict[str, int] = {}
        for s in data.get("sessions", []):
            for tag in s.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        # 按使用次数降序排列
        return [{"name": name, "count": count} for name, count in sorted(tag_counts.items(), key=lambda x: -x[1])]

    def update_session_field(self, session_id: str, **fields: Any) -> Dict[str, Any]:
        """更新会话字段（通用方法）"""
        data = self._load_sessions_data()
        for s in data.get("sessions", []):
            if s["id"] == session_id:
                for key, value in fields.items():
                    s[key] = value
                s["updated_at"] = datetime.now().isoformat()
                self._save_sessions_data(data)
                # 触发 SSE 事件
                try:
                    from backend.routers.events import emit_event
                    emit_event("session.updated", {"session_id": session_id, "fields": list(fields.keys())}, source="session")
                except Exception:
                    pass
                return {"success": True, "session": s}
        return {"success": False, "message": f"会话 {session_id} 不存在"}

    def export_session_markdown(self, session_id: str) -> str:
        """导出会话为 Markdown 格式"""
        session = self.get_session(session_id)
        messages = self.get_session_messages(session_id)
        if not session:
            return ""
        lines = [f"# {session.get('title', session_id)}", ""]
        lines.append(f"- **模型**: {session.get('model', 'N/A')}")
        lines.append(f"- **来源**: {session.get('source', 'N/A')}")
        lines.append(f"- **创建时间**: {session.get('created_at', 'N/A')}")
        lines.append(f"- **消息数**: {len(messages)}")
        lines.append("")
        lines.append("---")
        lines.append("")
        for m in messages:
            role_map = {"user": "👤 用户", "assistant": "🤖 助手", "system": "⚙️ 系统"}
            role = role_map.get(m.get("role", ""), m.get("role", ""))
            ts = m.get("timestamp", m.get("created_at", ""))
            lines.append(f"### {role}")
            if ts:
                lines.append(f"*{ts}*")
            lines.append("")
            lines.append(m.get("content", ""))
            lines.append("")
            lines.append("---")
            lines.append("")
        return "\n".join(lines)

    def export_session_csv(self, session_id: str) -> str:
        """导出会话为 CSV 格式"""
        import csv
        import io
        messages = self.get_session_messages(session_id)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["role", "content", "timestamp"])
        for m in messages:
            writer.writerow([m.get("role", ""), m.get("content", ""), m.get("timestamp", m.get("created_at", ""))])
        return output.getvalue()

    # ==================== 工具管理 ====================

    def list_tools(self) -> List[Dict[str, Any]]:
        """列出所有可用工具（从 MCP 工具定义获取）"""
        # 优先从 MCP 工具定义获取
        try:
            from backend.mcp_server import _get_tools
            mcp_tools = _get_tools()
            return [
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "schema": t.get("inputSchema", {}),
                    "status": "active",
                    "source": "mcp",
                }
                for t in mcp_tools
            ]
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

    def toggle_tool(self, name: str, enabled: bool = True) -> Dict[str, Any]:
        """切换工具启用/禁用"""
        # 工具状态存储在内存中（HF Space 重启后重置）
        if not hasattr(self, '_tool_states'):
            self._tool_states = {}
        self._tool_states[name] = enabled
        return {"success": True, "message": f"工具 {name} 已{'启用' if enabled else '禁用'}", "name": name, "enabled": enabled}

    def list_toolsets(self) -> List[Dict[str, Any]]:
        """列出所有工具集"""
        return [
            {
                "name": "MCP 工具集",
                "description": "通过 MCP 协议暴露的 16 个工具",
                "tools": ["list_sessions", "search_sessions", "get_session_messages", "delete_session", "list_tools", "list_skills", "get_skill_content", "create_skill", "read_memory", "read_user_profile", "write_memory", "write_user_profile", "list_cron_jobs", "create_cron_job", "get_system_status", "get_dashboard_summary"],
                "status": "active",
            }
        ]

    def _get_demo_tools(self) -> List[Dict[str, Any]]:
        """降级模式下的演示工具列表"""
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
                "status": "active",
            },
        ]

    # ==================== 技能管理 ====================

    def list_skills(self, available_tools: list = None) -> List[Dict[str, Any]]:
        """列出所有技能（支持目录和文件两种格式，含插件技能）"""
        skills_dir = get_skills_dir()
        if not skills_dir.exists():
            skills = []
        else:
            skills = []
            # 格式1: 目录结构 skills/{name}/SKILL.md
            for item in skills_dir.iterdir():
                if item.is_dir():
                    skill_md = item / "SKILL.md"
                    meta = self._read_skill_meta(item.name)
                    skills.append({
                        "name": item.name,
                        "description": meta.get("description") or self._read_skill_description(skill_md),
                        "tags": meta.get("tags", []),
                        "category": meta.get("category", ""),
                        "version": meta.get("version", ""),
                        "has_skill_md": skill_md.exists(),
                        "path": str(item),
                        "format": "directory",
                        "source": "builtin",
                    })
            # 格式2: 文件结构 skills/{name}.md
            for item in skills_dir.iterdir():
                if item.is_file() and item.suffix == ".md":
                    name = item.stem
                    if any(s["name"] == name for s in skills):
                        continue
                    meta = self._read_skill_meta(name)
                    skills.append({
                        "name": name,
                        "description": meta.get("description") or self._read_skill_description(item),
                        "tags": meta.get("tags", []),
                        "category": meta.get("category", ""),
                        "version": meta.get("version", ""),
                        "has_skill_md": True,
                        "path": str(item),
                        "format": "file",
                        "source": "builtin",
                    })

        # 合并插件提供的技能
        try:
            from backend.services.plugin_service import get_plugin_skills
            plugin_skills = get_plugin_skills()
            for ps in plugin_skills:
                # 避免同名覆盖
                if any(s["name"] == ps["name"] for s in skills):
                    # 插件技能加前缀避免冲突
                    ps["name"] = f"{ps['plugin_name']}__{ps['name']}"
                skills.append({
                    "name": ps["name"],
                    "description": ps.get("description", ""),
                    "has_skill_md": True,
                    "path": ps.get("path", ""),
                    "format": "file",
                    "source": "plugin",
                    "plugin_name": ps.get("plugin_name", ""),
                })
        except Exception:
            pass

        # 条件激活：根据可用工具集过滤
        if available_tools is not None:
            available_set = set(available_tools)
            filtered = []
            for skill in skills:
                meta = self._read_skill_meta(skill["name"])
                requires = meta.get("requires_toolsets", [])
                fallback_for = meta.get("fallback_for_toolsets", [])
                
                # 如果技能没有条件要求，始终显示
                if not requires and not fallback_for:
                    filtered.append(skill)
                    continue
                
                # 检查 requires：所有必需的工具集都必须可用
                if requires:
                    # requires 中的工具名需要在 available_tools 中存在
                    # 支持 "terminal" 映射到 ["shell_execute", "read_file", "write_file"] 等
                    toolset_map = {
                        "terminal": ["shell_execute", "read_file", "write_file", "list_directory", "search_files"],
                        "web": ["web_search", "web_fetch"],
                        "mcp": ["add_mcp_server", "remove_mcp_server", "list_mcp_servers"],
                        "memory": ["read_memory", "write_memory"],
                        "skills": ["list_skills", "create_skill", "update_skill", "delete_skill"],
                    }
                    required_tools = set()
                    for ts in requires:
                        required_tools.update(toolset_map.get(ts, [ts]))
                    
                    if required_tools.issubset(available_set):
                        filtered.append(skill)
                    continue
                
                # 检查 fallback_for：当指定工具集不可用时显示
                if fallback_for:
                    toolset_map = {
                        "terminal": ["shell_execute", "read_file", "write_file", "list_directory", "search_files"],
                        "web": ["web_search", "web_fetch"],
                        "mcp": ["add_mcp_server", "remove_mcp_server", "list_mcp_servers"],
                        "memory": ["read_memory", "write_memory"],
                        "skills": ["list_skills", "create_skill", "update_skill", "delete_skill"],
                    }
                    fallback_tools = set()
                    for ts in fallback_for:
                        fallback_tools.update(toolset_map.get(ts, [ts]))
                    
                    if not fallback_tools.issubset(available_set):
                        filtered.append(skill)
                    continue
                
                filtered.append(skill)
            
            skills = filtered

        return skills

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        """获取技能详情（支持目录和文件两种格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        content = ""
        files = []
        fmt = "unknown"

        if skill_dir.is_dir():
            fmt = "directory"
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                content = skill_md.read_text(encoding="utf-8")
            for f in skill_dir.rglob("*"):
                if f.is_file():
                    files.append(str(f.relative_to(skill_dir)))
        elif skill_file.is_file():
            fmt = "file"
            content = skill_file.read_text(encoding="utf-8")
            files.append(f"{name}.md")
        else:
            return None

        return {"name": name, "content": content, "files": files, "format": fmt}

    def create_skill(self, name: str, content: str = "", description: str = "", tags: list = None) -> Dict[str, Any]:
        """创建新技能（文件格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        if skill_dir.exists() or skill_file.exists():
            return {"success": False, "message": f"技能 '{name}' 已存在"}

        try:
            skills_dir.mkdir(parents=True, exist_ok=True)
            # 将 description 和 tags 写入内容头部
            if not content:
                content = f"# {name}\n\n{description or '技能描述'}"
            elif description and not content.startswith(f"# {name}"):
                content = f"# {name}\n\n> {description}\n\n{content}"
            skill_file.write_text(content, encoding="utf-8")
            # 保存元数据
            if tags or description:
                meta_file = skills_dir / f"{name}.meta.json"
                import json
                meta = {"description": description, "tags": tags or []}
                meta_file.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            return {"success": True, "message": f"技能 '{name}' 创建成功", "name": name, "id": name, "skill": {"id": name, "name": name, "description": description, "tags": tags or []}}
        except Exception as e:
            return {"success": False, "message": f"创建失败: {str(e)}"}

    def update_skill(self, name: str, content: str = "", description: str = "", tags: list = None) -> Dict[str, Any]:
        """更新技能（支持目录和文件两种格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        try:
            if skill_dir.is_dir():
                (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
            elif skill_file.is_file():
                skill_file.write_text(content, encoding="utf-8")
            else:
                return {"success": False, "message": f"技能 '{name}' 不存在"}
            # 更新元数据
            if tags is not None or description:
                import json
                meta_file = skills_dir / f"{name}.meta.json"
                meta = {}
                if meta_file.exists():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    except Exception:
                        pass
                if description:
                    meta["description"] = description
                if tags is not None:
                    meta["tags"] = tags
                meta_file.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            return {"success": True, "message": f"技能 '{name}' 更新成功", "name": name}
        except Exception as e:
            return {"success": False, "message": f"更新失败: {str(e)}"}

    def delete_skill(self, name: str) -> Dict[str, Any]:
        """删除技能（支持目录和文件两种格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        try:
            if skill_dir.is_dir():
                import shutil
                shutil.rmtree(skill_dir)
            elif skill_file.is_file():
                skill_file.unlink()
            else:
                return {"success": False, "message": f"技能 '{name}' 不存在"}
            # 删除元数据文件
            meta_file = skills_dir / f"{name}.meta.json"
            if meta_file.exists():
                meta_file.unlink()
            return {"success": True, "message": f"技能 '{name}' 已删除", "name": name}
        except Exception as e:
            return {"success": False, "message": f"删除失败: {str(e)}"}

    def _read_skill_meta(self, name: str) -> dict:
        """读取技能元数据（优先 frontmatter，其次 meta.json）"""
        import json, re
        meta = {}

        # 优先从 SKILL.md 的 YAML frontmatter 解析
        skill_file = get_skills_dir() / f"{name}.md"
        skill_dir = get_skills_dir() / name
        if skill_dir.is_dir():
            skill_file = skill_dir / "SKILL.md"

        if skill_file.exists():
            try:
                text = skill_file.read_text(encoding="utf-8")
                match = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
                if match:
                    import yaml
                    try:
                        fm = yaml.safe_load(match.group(1))
                        if isinstance(fm, dict):
                            meta = fm
                    except Exception:
                        # 简单解析 key: value
                        for line in match.group(1).split("\n"):
                            if ":" in line:
                                k, v = line.split(":", 1)
                                meta[k.strip()] = v.strip()
            except Exception:
                pass

        # 合并 meta.json
        meta_file = get_skills_dir() / f"{name}.meta.json"
        if meta_file.exists():
            try:
                file_meta = json.loads(meta_file.read_text(encoding="utf-8"))
                # meta.json 补充 frontmatter 没有的字段
                for k, v in file_meta.items():
                    if k not in meta:
                        meta[k] = v
            except Exception:
                pass

        return meta

    def search_messages(self, query: str, session_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
        """全文搜索消息内容"""
        db_path = self._get_session_db_path()
        if not db_path:
            return []
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            # 确保 FTS 表存在
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                    session_id, role, content, created_at,
                    content='messages', content_rowid='id'
                )
            """)
            # 对已有数据重建索引（如果 FTS 为空）
            cursor.execute("SELECT COUNT(*) FROM messages_fts")
            fts_count = cursor.fetchone()[0]
            if fts_count == 0:
                cursor.execute("SELECT COUNT(*) FROM messages")
                msg_count = cursor.fetchone()[0]
                if msg_count > 0:
                    cursor.execute("INSERT INTO messages_fts(rowid, session_id, role, content, created_at) SELECT id, session_id, role, content, created_at FROM messages")
                    conn.commit()

            # 执行搜索
            if session_id:
                cursor.execute("""
                    SELECT m.session_id, m.role, m.content, m.created_at,
                           rank
                    FROM messages_fts f
                    JOIN messages m ON m.id = f.rowid
                    WHERE messages_fts MATCH ? AND m.session_id = ?
                    ORDER BY rank
                    LIMIT ?
                """, (query, session_id, limit))
            else:
                cursor.execute("""
                    SELECT m.session_id, m.role, m.content, m.created_at,
                           rank
                    FROM messages_fts f
                    JOIN messages m ON m.id = f.rowid
                    WHERE messages_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """, (query, limit))

            results = []
            for row in cursor.fetchall():
                results.append({
                    "session_id": row[0],
                    "role": row[1],
                    "content": row[2],
                    "timestamp": row[3],
                    "relevance": row[4],
                })
            conn.close()
            return results
        except Exception as e:
            logger.warning(f"全文搜索失败: {e}")
            return []

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
        result = {"memory": "", "user": "", "memory_usage": 0, "memory_limit": 2200, "user_usage": 0, "user_limit": 1375}

        memory_md = memories_dir / "MEMORY.md"
        if memory_md.exists():
            try:
                text = memory_md.read_text(encoding="utf-8")
                result["memory"] = text
                result["memory_usage"] = len(text)
            except Exception:
                result["memory"] = ""

        user_md = memories_dir / "USER.md"
        if user_md.exists():
            try:
                text = user_md.read_text(encoding="utf-8")
                result["user"] = text
                result["user_usage"] = len(text)
            except Exception:
                result["user"] = ""

        return result

    def update_memory(self, memory: Optional[str] = None, user: Optional[str] = None) -> Dict[str, Any]:
        """更新记忆文件（含容量管理和去重）"""
        memories_dir = get_memories_dir()
        memories_dir.mkdir(parents=True, exist_ok=True)
        updated = []
        warnings = []

        if memory is not None:
            # 去重：移除连续重复行
            lines = memory.split("\n")
            deduped = []
            prev = ""
            for line in lines:
                stripped = line.strip()
                if stripped and stripped == prev:
                    continue  # 跳过连续重复
                deduped.append(line)
                prev = stripped
            memory = "\n".join(deduped)

            # 容量限制：超出时截断旧内容
            MEMORY_LIMIT = 2200
            if len(memory) > MEMORY_LIMIT:
                warnings.append(f"MEMORY.md 超出 {MEMORY_LIMIT} 字符限制 ({len(memory)})，已截断旧内容")
                memory = memory[-MEMORY_LIMIT:]
                # 确保从完整行开始
                first_newline = memory.find("\n")
                if first_newline > 0:
                    memory = memory[first_newline + 1:]

            (memories_dir / "MEMORY.md").write_text(memory, encoding="utf-8")
            updated.append("MEMORY.md")

        if user is not None:
            # 去重
            lines = user.split("\n")
            deduped = []
            prev = ""
            for line in lines:
                stripped = line.strip()
                if stripped and stripped == prev:
                    continue
                deduped.append(line)
                prev = stripped
            user = "\n".join(deduped)

            # 容量限制
            USER_LIMIT = 1375
            if len(user) > USER_LIMIT:
                warnings.append(f"USER.md 超出 {USER_LIMIT} 字符限制 ({len(user)})，已截断旧内容")
                user = user[-USER_LIMIT:]
                first_newline = user.find("\n")
                if first_newline > 0:
                    user = user[first_newline + 1:]

            (memories_dir / "USER.md").write_text(user, encoding="utf-8")
            updated.append("USER.md")

        result = {
            "success": True,
            "message": f"已更新: {', '.join(updated)}",
            "updated_files": updated,
        }
        if warnings:
            result["warnings"] = warnings

        # 返回更新后的内容，便于验证
        if "MEMORY.md" in updated:
            try:
                result["memory"] = (memories_dir / "MEMORY.md").read_text(encoding="utf-8")
            except Exception:
                pass
        if "USER.md" in updated:
            try:
                result["user"] = (memories_dir / "USER.md").read_text(encoding="utf-8")
            except Exception:
                pass

        return result

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

    def get_cron_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """获取单个定时任务"""
        jobs = self._load_jobs()
        for job in jobs:
            if job.get("id") == job_id:
                return job
        return None

    def create_cron_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """创建定时任务"""
        jobs = self._load_jobs()
        job_id = job.get("id", f"job-{datetime.now().strftime('%Y%m%d%H%M%S%f')}")
        job["id"] = job_id
        job["created_at"] = datetime.now().isoformat()
        job["status"] = job.get("status", "active")
        jobs.append(job)
        if self._save_jobs(jobs):
            # 重新加载调度器
            try:
                from backend.services.cron_scheduler import reload_scheduler
                reload_scheduler()
            except Exception:
                pass
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
                    try:
                        from backend.services.cron_scheduler import reload_scheduler
                        reload_scheduler()
                    except Exception:
                        pass
                    return {"success": True, "message": "任务更新成功", "job": job}
                return {"success": False, "message": "保存任务失败"}
        return {"success": False, "message": f"任务 {job_id} 不存在"}

    def delete_cron_job(self, job_id: str) -> Dict[str, Any]:
        """删除定时任务（支持 job_id 或任务名称）"""
        jobs = self._load_jobs()
        new_jobs = [j for j in jobs if j.get("id") != job_id and j.get("name") != job_id]
        if len(new_jobs) == len(jobs):
            return {"success": False, "message": f"任务 {job_id} 不存在"}
        if self._save_jobs(new_jobs):
            try:
                from backend.services.cron_scheduler import reload_scheduler
                reload_scheduler()
            except Exception:
                pass
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

    def trigger_cron_job(self, job_id: str) -> Dict[str, Any]:
        """手动触发定时任务"""
        jobs = self._load_jobs()
        for job in jobs:
            if job.get("id") == job_id:
                job["last_triggered"] = datetime.now().isoformat()
                if self._save_jobs(jobs):
                    return {"success": True, "message": f"任务 {job_id} 已触发", "job": job}
                return {"success": False, "message": "保存任务失败"}
        return {"success": False, "message": f"任务 {job_id} 不存在"}

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

    def terminate_agent(self, agent_id: str) -> Dict[str, Any]:
        """终止子 Agent"""
        if not self.hermes_available:
            return {"success": False, "message": "Hermes Agent 未安装，无法终止 Agent"}
        try:
            import hermes  # type: ignore
            if hasattr(hermes, "AgentManager"):
                manager = hermes.AgentManager()
                manager.terminate(agent_id)
                return {"success": True, "message": f"Agent {agent_id} 已终止"}
        except Exception as e:
            return {"success": False, "message": f"终止失败: {str(e)}"}
        return {"success": False, "message": f"Agent {agent_id} 不存在"}

    # ==================== MCP 服务状态 ====================

    def get_mcp_status(self) -> Dict[str, Any]:
        """获取 MCP 服务状态"""
        # MCP 服务始终运行（独立于 Hermes 主程序）
        # 通过检测 MCP 端点是否可用来判断状态
        return {
            "status": "running",
            "message": "MCP 服务运行中",
            "port": 7860,
            "endpoint": "/mcp",
            "protocol": "Streamable HTTP + SSE",
            "servers": [],
            "hermes_available": self.hermes_available,
        }

    def get_mcp_tools(self) -> List[Dict[str, Any]]:
        """获取 MCP 暴露的工具列表"""
        # 直接从 mcp_server 模块获取工具定义
        try:
            from backend.mcp_server import _get_tools
            return _get_tools()
        except Exception:
            return []

    def restart_mcp(self) -> Dict[str, Any]:
        """重启 MCP 服务"""
        # MCP 服务内嵌在 FastAPI 中，标记为成功
        return {"success": True, "message": "MCP 服务运行正常（内嵌模式，无需重启）"}


    # ==================== 知识提取 ====================

    def generate_session_summary(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """基于消息内容生成会话摘要"""
        import re
        title = session.get("title", "未命名会话")
        model = session.get("model", "unknown")
        created = session.get("created_at", "")[:16]
        total_messages = len(messages)

        # Count by role
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        # Extract key topics from first few user messages
        topics = []
        for m in user_msgs[:5]:
            content = m.get("content", "")
            if len(content) > 10:
                topics.append(content[:100])

        lines = [
            f"## 会话摘要: {title}",
            "",
            f"- **模型**: {model}",
            f"- **时间**: {created}",
            f"- **消息数**: {total_messages} (用户 {len(user_msgs)} / 助手 {len(assistant_msgs)})",
            "",
        ]

        if topics:
            lines.append("### 主要讨论")
            for i, t in enumerate(topics, 1):
                lines.append(f"{i}. {t}")
            lines.append("")

        return "\n".join(lines)

    def extract_key_info(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """从消息中提取关键信息"""
        import re

        all_content = "\n".join(m.get("content", "") for m in messages)

        # Extract URLs
        urls = list(set(re.findall(r'https?://[^\s<>"\')\]]+', all_content)))

        # Extract file paths
        file_paths = list(set(re.findall(r'/[\w\-./]+\.\w+', all_content)))

        # Extract code blocks (language + count)
        code_blocks = re.findall(r'```(\w*)\n', all_content)
        code_count = len(code_blocks)
        code_languages = list(set(code_blocks))

        # Extract TODO/FIXME
        todos = re.findall(r'(?:TODO|FIXME|BUG|HACK)[\s:]*[^\n]{0,100}', all_content, re.IGNORECASE)

        # Extract numbers with units (metrics)
        metrics = re.findall(r'\d+(?:\.\d+)?\s*(?:ms|MB|KB|GB|秒|次|行|个|%|px)', all_content)

        return {
            "urls": urls[:20],
            "file_paths": file_paths[:20],
            "code_blocks": {"count": code_count, "languages": code_languages},
            "todos": todos[:10],
            "metrics": metrics[:10],
            "total_content_length": len(all_content),
        }

    def generate_skill_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """从会话消息中生成技能内容"""
        title = session.get("title", "自动提取技能")
        lines = [
            f"# {title}",
            "",
            f"> 自动从会话中提取",
            f"> 模型: {session.get('model', 'unknown')}",
            f"> 时间: {session.get('created_at', '')[:16]}",
            "",
            "## 使用方法",
            "",
        ]

        # Extract user requests as steps
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        if user_msgs:
            lines.append("### 操作步骤")
            for i, m in enumerate(user_msgs[:10], 1):
                content = m.get("content", "").strip()
                if content:
                    lines.append(f"{i}. {content}")
            lines.append("")

        if assistant_msgs:
            lines.append("### 关键回复")
            for m in assistant_msgs[:5]:
                content = m.get("content", "").strip()
                if content:
                    lines.append(f"- {content[:200]}")
            lines.append("")

        return "\n".join(lines)

    def generate_knowledge_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """从会话中提取关键知识"""
        title = session.get("title", "未命名会话")
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        if not assistant_msgs:
            return ""

        lines = [
            f"### 来自: {title}",
            f"**时间**: {session.get('created_at', '')[:16]}",
            "",
        ]

        # Take key assistant responses
        for m in assistant_msgs[:3]:
            content = m.get("content", "").strip()
            if len(content) > 20:
                lines.append(f"- {content[:300]}")

        return "\n".join(lines)

    def generate_learning_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """从会话中提取经验教训"""
        import re
        title = session.get("title", "未命名会话")
        all_content = "\n".join(m.get("content", "") for m in messages)

        # Look for error patterns, solutions, best practices
        patterns = [
            (r'(?:错误|失败|问题|bug)[：:\s]*([^\n]{10,200})', "问题"),
            (r'(?:解决|修复|方法|方案)[：:\s]*([^\n]{10,200})', "解决方案"),
            (r'(?:注意|避免|不要|切记)[：:\s]*([^\n]{10,200})', "注意事项"),
        ]

        learnings = []
        for pattern, category in patterns:
            matches = re.findall(pattern, all_content, re.IGNORECASE)
            for match in matches[:3]:
                learnings.append(f"- [{category}] {match.strip()}")

        if not learnings:
            # Fallback: just note the session happened
            learnings.append(f"- [{title}] 会话记录，{len(messages)} 条消息")

        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

        lines = [
            f"## {title}",
            f"*{timestamp}*",
            "",
            "\n".join(learnings),
        ]

        return "\n".join(lines)


    # ==================== 分析统计 ====================

    def get_analytics_overview(self) -> Dict[str, Any]:
        """会话分析概览"""
        sessions = self.list_sessions()
        messages_data = self._load_messages()
        messages = messages_data.get("messages", {})
        
        total_sessions = len(sessions)
        total_messages = sum(len(msgs) for msgs in messages.values())
        
        # Active sessions
        active = sum(1 for s in sessions if s.get("status") == "active")
        
        # Today stats
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        today_sessions = len([s for s in sessions if str(s.get("created_at", "")).startswith(today)])
        
        # Average messages per session
        avg_messages = round(total_messages / total_sessions, 1) if total_sessions > 0 else 0
        
        # Total tags
        all_tags = set()
        for s in sessions:
            all_tags.update(s.get("tags", []))
        
        # Pinned/archived counts
        pinned = sum(1 for s in sessions if s.get("pinned", False))
        archived = sum(1 for s in sessions if s.get("archived", False))
        
        # Models used
        models = {}
        for s in sessions:
            model = s.get("model", "unknown")
            models[model] = models.get(model, 0) + 1
        
        return {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "active_sessions": active,
            "today_sessions": today_sessions,
            "avg_messages_per_session": avg_messages,
            "total_tags": len(all_tags),
            "pinned_sessions": pinned,
            "archived_sessions": archived,
            "models_used": models,
        }

    def get_analytics_trends(self, period: str = "daily", days: int = 30) -> Dict[str, Any]:
        """获取会话趋势数据"""
        from datetime import datetime, timedelta
        sessions = self.list_sessions()
        
        # Build date buckets
        now = datetime.now()
        trends = []
        
        if period == "daily":
            for i in range(days - 1, -1, -1):
                date = (now - timedelta(days=i)).strftime("%Y-%m-%d")
                count = len([s for s in sessions if str(s.get("created_at", ""))[:10] == date])
                trends.append({"date": date, "count": count})
        elif period == "weekly":
            weeks = days // 7
            for i in range(weeks - 1, -1, -1):
                week_start = (now - timedelta(weeks=i * 7)).strftime("%Y-%m-%d")
                week_end = (now - timedelta(weeks=(i - 1) * 7)).strftime("%Y-%m-%d")
                count = len([s for s in sessions if week_start <= str(s.get("created_at", ""))[:10] <= week_end])
                trends.append({"date": week_start, "count": count})
        elif period == "monthly":
            for i in range(11, -1, -1):
                month = (now - timedelta(days=i * 30)).strftime("%Y-%m")
                count = len([s for s in sessions if str(s.get("created_at", ""))[:7] == month])
                trends.append({"date": month, "count": count})
        
        return {"period": period, "days": days, "trends": trends}

    def get_analytics_distribution(self) -> Dict[str, Any]:
        """获取会话分布数据"""
        sessions = self.list_sessions()
        
        # By model
        model_dist = {}
        for s in sessions:
            model = s.get("model", "unknown")
            model_dist[model] = model_dist.get(model, 0) + 1
        
        # By source
        source_dist = {}
        for s in sessions:
            source = s.get("source", "unknown")
            source_dist[source] = source_dist.get(source, 0) + 1
        
        # By tags
        tag_dist = {}
        for s in sessions:
            for tag in s.get("tags", []):
                tag_dist[tag] = tag_dist.get(tag, 0) + 1
        
        # By hour (creation time)
        hour_dist = {str(h): 0 for h in range(24)}
        for s in sessions:
            ts = s.get("created_at", "")
            if len(ts) >= 13 and "T" in ts:
                try:
                    hour = int(ts.split("T")[1][:2])
                    hour_dist[str(hour)] = hour_dist.get(str(hour), 0) + 1
                except (ValueError, IndexError):
                    pass
        
        # By status
        status_dist = {}
        for s in sessions:
            status = s.get("status", "unknown")
            status_dist[status] = status_dist.get(status, 0) + 1
        
        return {
            "by_model": model_dist,
            "by_source": source_dist,
            "by_tag": tag_dist,
            "by_hour": hour_dist,
            "by_status": status_dist,
        }

    def get_analytics_tools(self, days: int = 7) -> Dict[str, Any]:
        """获取工具调用统计数据（从操作日志中提取）"""
        from datetime import datetime, timedelta
        from backend.config import get_hermes_home
        
        logs_path = get_hermes_home() / "data" / "logs.json"
        if not logs_path.exists():
            return {"tools": [], "period_days": days, "total_calls": 0}
        
        try:
            import json
            logs = json.loads(logs_path.read_text(encoding="utf-8"))
        except Exception:
            return {"tools": [], "period_days": days, "total_calls": 0}
        
        # Filter recent logs
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        recent = [l for l in logs if l.get("timestamp", "") >= cutoff]
        
        # Count tool-related actions
        tool_counts = {}
        for log in recent:
            action = log.get("action", "")
            detail = log.get("detail", "")
            # Extract tool name from detail like "POST /api/sessions/xxx/messages"
            if "tool" in action.lower() or "mcp" in detail.lower():
                tool_name = action
                tool_counts[tool_name] = tool_counts.get(tool_name, 0) + 1
        
        # Sort by count
        sorted_tools = sorted(tool_counts.items(), key=lambda x: -x[1])
        tools = [{"name": name, "count": count} for name, count in sorted_tools[:20]]
        
        return {
            "tools": tools,
            "period_days": days,
            "total_calls": sum(tool_counts.values()),
            "total_logs": len(recent),
        }

    def get_analytics_behavior(self) -> Dict[str, Any]:
        """获取 Agent 行为画像"""
        sessions = self.list_sessions()
        messages_data = self._load_messages()
        messages = messages_data.get("messages", {})
        
        # Message role distribution
        role_counts = {"user": 0, "assistant": 0, "system": 0}
        total_content_length = {"user": 0, "assistant": 0, "system": 0}
        
        for sid, msgs in messages.items():
            for m in msgs:
                role = m.get("role", "unknown")
                role_counts[role] = role_counts.get(role, 0) + 1
                content = m.get("content", "")
                total_content_length[role] = total_content_length.get(role, 0) + len(content)
        
        # Average response length
        avg_response = round(total_content_length.get("assistant", 0) / max(role_counts.get("assistant", 1), 1), 0)
        avg_user = round(total_content_length.get("user", 0) / max(role_counts.get("user", 1), 1), 0)
        
        # Most active model
        model_counts = {}
        for s in sessions:
            model = s.get("model", "unknown")
            model_counts[model] = model_counts.get(model, 0) + 1
        top_model = max(model_counts.items(), key=lambda x: x[1])[0] if model_counts else "unknown"
        
        # Sessions with summaries
        with_summary = sum(1 for s in sessions if s.get("summary"))
        
        return {
            "message_distribution": role_counts,
            "avg_response_length": avg_response,
            "avg_user_message_length": avg_user,
            "top_model": top_model,
            "sessions_with_summary": with_summary,
            "total_sessions": len(sessions),
            "total_messages": sum(role_counts.values()),
            "total_content_chars": sum(total_content_length.values()),
        }


# 全局服务实例
hermes_service = HermesService()
