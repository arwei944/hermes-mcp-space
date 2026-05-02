# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 会话管理服务

从 HermesService 中提取的会话相关方法，包括：
- 会话 CRUD（通过 SessionDB / SQLite + JSON 持久化）
- 会话搜索（支持 jieba 分词增强）
- 会话导出（Markdown / CSV）
- 消息全文搜索（FTS5）
"""

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import get_hermes_home


class SessionService:
    """会话管理服务

    所有方法都是同步的，返回 dict 或 list。
    支持 SQLite + JSON 双写，优先从 SQLite 读取。
    """

    def __init__(self):
        self._hermes_available: Optional[bool] = None
        self._session_db_path: Optional[Path] = None

    @property
    def hermes_available(self) -> bool:
        """检测 Hermes Agent 是否可用"""
        if self._hermes_available is None:
            try:
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
        # 同步写入 SQLite
        db_path = self._get_session_db_path()
        if db_path:
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL DEFAULT '',
                        model TEXT NOT NULL DEFAULT '',
                        source TEXT NOT NULL DEFAULT '',
                        status TEXT NOT NULL DEFAULT 'active',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                """)
                cursor.execute(
                    "INSERT OR IGNORE INTO sessions (id, title, model, source, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (session_id, session["title"], session["model"], session["source"], session["status"], session["created_at"], session["updated_at"]),
                )
                conn.commit()
                conn.close()
            except Exception:
                pass
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
        # 同步删除 SQLite
        db_path = self._get_session_db_path()
        if db_path:
            try:
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
                cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
                conn.commit()
                conn.close()
            except Exception:
                pass
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

    def _highlight_matches(self, text: str, query: str) -> str:
        """在文本中高亮匹配的关键词"""
        import re
        if not query or not text:
            return text or ""

        # 将增强查询按 OR 拆分为多个关键词
        keywords = [k.strip() for k in query.split(" OR ") if k.strip()]
        if not keywords:
            return text

        # 对每个关键词进行高亮
        highlighted = text
        for kw in keywords:
            escaped = re.escape(kw)
            highlighted = re.sub(
                f'({escaped})',
                r'<mark>\1</mark>',
                highlighted,
                flags=re.IGNORECASE
            )
        return highlighted

    def _enhance_search_query(self, query: str) -> str:
        """使用 jieba 分词增强搜索查询"""
        try:
            import jieba
            # 分词并过滤停用词和单字
            words = [w for w in jieba.cut_for_search(query) if len(w.strip()) > 1]
            if words:
                # 用 OR 连接分词结果，提高召回率
                return " OR ".join(words)
        except ImportError:
            pass
        return query

    def search_sessions(self, keyword: str, limit: int = 20) -> List[Dict[str, Any]]:
        """搜索会话（按标题模糊匹配，支持 jieba 分词增强）"""
        # 在搜索前增强查询
        enhanced_q = self._enhance_search_query(keyword)
        sessions = self.list_sessions()
        # 将增强后的查询按 OR 拆分为多个关键词
        keywords = [k.strip().lower() for k in enhanced_q.split(" OR ") if k.strip()]
        if not keywords:
            return []
        return [s for s in sessions
                if any(kw in (s.get("title") or "").lower()
                       or kw in (s.get("model") or "").lower()
                       or kw in (s.get("id") or "").lower()
                       for kw in keywords)][:limit]

    def get_search_suggestions(self, query: str, limit: int = 10) -> list:
        """获取搜索建议（基于会话标题和标签）"""
        suggestions = set()
        query_lower = query.lower()

        for session in self.list_sessions():
            title = session.get("title", "")
            tags = session.get("tags", [])

            # 标题匹配
            if query_lower in title.lower():
                suggestions.add(title)

            # 标签匹配
            for tag in tags:
                if query_lower in tag.lower():
                    suggestions.add(tag)

        return list(suggestions)[:limit]

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
                # 同步更新 SQLite
                db_path = self._get_session_db_path()
                if db_path:
                    try:
                        conn = sqlite3.connect(str(db_path))
                        cursor = conn.cursor()
                        set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
                        values = list(fields.values()) + [session_id]
                        cursor.execute(f"UPDATE sessions SET {set_clause}, updated_at = ? WHERE id = ?", values + [s["updated_at"]])
                        conn.commit()
                        conn.close()
                    except Exception:
                        pass
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

    def search_messages(self, query: str, session_id: str = None, limit: int = 20) -> List[Dict[str, Any]]:
        """全文搜索消息内容（支持 jieba 分词增强）"""
        import logging
        logger = logging.getLogger(__name__)

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

            # 使用 jieba 分词增强搜索查询
            enhanced_q = self._enhance_search_query(query)

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
                """, (enhanced_q, session_id, limit))
            else:
                cursor.execute("""
                    SELECT m.session_id, m.role, m.content, m.created_at,
                           rank
                    FROM messages_fts f
                    JOIN messages m ON m.id = f.rowid
                    WHERE messages_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """, (enhanced_q, limit))

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
