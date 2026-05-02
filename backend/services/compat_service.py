"""
向后兼容层 — SQLite ↔ MD 文件双向同步
确保 MEMORY.md / USER.md / learnings.md 继续可用
"""

import json
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

from backend.db import HERMES_HOME, get_knowledge_db


class CompatService:
    """向后兼容服务"""

    def __init__(self):
        self.conn = get_knowledge_db()
        self.memories_dir = HERMES_HOME / "memories"
        self.memories_dir.mkdir(parents=True, exist_ok=True)

    # ============================================================
    # MEMORY.md 兼容
    # ============================================================

    def export_memory_md(self) -> str:
        """将 memories 表导出为 MEMORY.md 格式"""
        rows = self.conn.execute(
            "SELECT content FROM memories WHERE category='agent_memory' AND is_active=1 ORDER BY importance DESC, updated_at DESC"
        ).fetchall()
        if not rows:
            return ""
        return "\n\n---\n\n".join(row["content"] for row in rows)

    def export_user_md(self) -> str:
        """将 memories 表导出为 USER.md 格式"""
        rows = self.conn.execute(
            "SELECT content FROM memories WHERE category='user_profile' AND is_active=1 ORDER BY importance DESC, updated_at DESC"
        ).fetchall()
        if not rows:
            return ""
        return "\n\n---\n\n".join(row["content"] for row in rows)

    def save_memory_md(self):
        """将 memories 表写入 MEMORY.md 文件"""
        content = self.export_memory_md()
        md_path = self.memories_dir / "MEMORY.md"
        md_path.write_text(content, encoding="utf-8")

    def save_user_md(self):
        """将 memories 表写入 USER.md 文件"""
        content = self.export_user_md()
        md_path = self.memories_dir / "USER.md"
        md_path.write_text(content, encoding="utf-8")

    def import_memory_md(self) -> int:
        """从 MEMORY.md 导入到 memories 表（返回导入条数）"""
        md_path = self.memories_dir / "MEMORY.md"
        if not md_path.exists():
            return 0
        content = md_path.read_text(encoding="utf-8").strip()
        if not content:
            return 0
        return self._import_memories(content, "agent_memory")

    def import_user_md(self) -> int:
        """从 USER.md 导入到 memories 表"""
        md_path = self.memories_dir / "USER.md"
        if not md_path.exists():
            return 0
        content = md_path.read_text(encoding="utf-8").strip()
        if not content:
            return 0
        return self._import_memories(content, "user_profile")

    def _import_memories(self, content: str, category: str) -> int:
        """通用导入逻辑"""
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        entries = content.split("\n\n---\n\n")
        count = 0
        for i, entry in enumerate(entries):
            entry = entry.strip()
            if not entry or len(entry) < 5:
                continue
            title = entry.split("\n")[0][:50].replace("#", "").strip()
            if not title:
                title = f"导入记忆 #{i+1}"
            existing = self.conn.execute(
                "SELECT id FROM memories WHERE category=? AND content=? AND is_active=1",
                (category, entry)
            ).fetchone()
            if existing:
                continue
            self.conn.execute(
                """INSERT INTO memories (id, category, title, content, importance, source, created_by, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 5, 'imported', 'import', ?, ?)""",
                (f"mem_import_{category}_{i+1:04d}", category, title, entry, now, now)
            )
            count += 1
        self.conn.commit()
        return count

    # ============================================================
    # learnings.md 兼容
    # ============================================================

    def export_learnings_md(self) -> str:
        """将 experiences 表导出为 learnings.md 格式"""
        rows = self.conn.execute(
            "SELECT title, content, category, severity, is_resolved FROM experiences WHERE is_active=1 ORDER BY updated_at DESC"
        ).fetchall()
        if not rows:
            return ""
        sections = []
        for row in rows:
            status = "✅ 已解决" if row["is_resolved"] else "❌ 未解决"
            section = f"## {row['title']}\n\n**分类**: {row['category']} | **严重度**: {row['severity']} | **状态**: {status}\n\n{row['content']}"
            sections.append(section)
        return "\n\n---\n\n".join(sections)

    def save_learnings_md(self):
        """将 experiences 表写入 learnings.md"""
        content = self.export_learnings_md()
        md_path = HERMES_HOME / "learnings.md"
        md_path.write_text(content, encoding="utf-8")

    def import_learnings_md(self) -> int:
        """从 learnings.md 导入到 experiences 表"""
        md_path = HERMES_HOME / "learnings.md"
        if not md_path.exists():
            return 0
        content = md_path.read_text(encoding="utf-8").strip()
        if not content:
            return 0

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        sections = content.split("\n## ")
        count = 0
        for i, section in enumerate(sections):
            section = section.strip()
            if not section or len(section) < 10:
                continue
            lines = section.split("\n")
            title = lines[0].strip()
            body = "\n".join(lines[1:]).strip()

            existing = self.conn.execute(
                "SELECT id FROM experiences WHERE title=? AND is_active=1",
                (title,)
            ).fetchone()
            if existing:
                continue

            category = "best_practice"
            if "错误" in title or "error" in title.lower():
                category = "error_pattern"
            elif "坑" in title or "注意" in title:
                category = "pitfall"

            self.conn.execute(
                """INSERT INTO experiences (id, title, content, category, source, created_by, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'imported', 'import', ?, ?)""",
                (f"exp_import_{i+1:04d}", title, body, category, now, now)
            )
            count += 1
        self.conn.commit()
        return count

    # ============================================================
    # MCP 工具兼容映射
    # ============================================================

    def handle_legacy_memory_read(self) -> dict:
        """兼容旧的 read_memory MCP 工具"""
        agent_memories = self.conn.execute(
            "SELECT content FROM memories WHERE category='agent_memory' AND is_active=1 ORDER BY importance DESC LIMIT 20"
        ).fetchall()
        user_memories = self.conn.execute(
            "SELECT content FROM memories WHERE category='user_profile' AND is_active=1 ORDER BY importance DESC LIMIT 20"
        ).fetchall()

        memory_text = "\n\n".join(r["content"] for r in agent_memories)
        user_text = "\n\n".join(r["content"] for r in user_memories)

        return {
            "memory": memory_text,
            "user": user_text,
            "memory_usage": len(memory_text),
            "memory_limit": 999999,
            "user_usage": len(user_text),
            "user_limit": 999999
        }

    def handle_legacy_memory_write(self, memory: str = None, user: str = None) -> dict:
        """兼容旧的 write_memory MCP 工具"""
        from backend.services.review_service import ReviewService
        review_svc = ReviewService()
        review_ids = []

        if memory and memory.strip():
            review = review_svc.submit_review(
                target_type="memory", action="create",
                title="Agent 记忆（兼容写入）",
                content=json.dumps({"content": memory, "category": "agent_memory", "importance": 5}, ensure_ascii=False),
                reason="通过旧 MCP 工具 write_memory 写入"
            )
            review_ids.append(review["id"])

        if user and user.strip():
            review = review_svc.submit_review(
                target_type="memory", action="create",
                title="用户画像（兼容写入）",
                content=json.dumps({"content": user, "category": "user_profile", "importance": 5}, ensure_ascii=False),
                reason="通过旧 MCP 工具 write_user_profile 写入"
            )
            review_ids.append(review["id"])

        return {
            "success": True,
            "message": f"已提交 {len(review_ids)} 条审核",
            "review_ids": review_ids
        }

    # ============================================================
    # Obsidian 同步适配
    # ============================================================

    def sync_to_obsidian(self, vault_path: str) -> dict:
        """同步到 Obsidian Vault"""
        vault = Path(vault_path)
        if not vault.exists():
            return {"success": False, "error": f"Vault 路径不存在: {vault_path}"}

        hermes_dir = vault / ".hermes-knowledge"
        hermes_dir.mkdir(parents=True, exist_ok=True)

        results = {}
        memory_content = self.export_memory_md()
        (hermes_dir / "MEMORY.md").write_text(memory_content, encoding="utf-8")
        results["memory"] = len(memory_content)

        user_content = self.export_user_md()
        (hermes_dir / "USER.md").write_text(user_content, encoding="utf-8")
        results["user"] = len(user_content)

        learnings_content = self.export_learnings_md()
        (hermes_dir / "learnings.md").write_text(learnings_content, encoding="utf-8")
        results["learnings"] = len(learnings_content)

        return {"success": True, "data": results}

    def sync_from_obsidian(self, vault_path: str) -> dict:
        """从 Obsidian Vault 同步"""
        vault = Path(vault_path)
        hermes_dir = vault / ".hermes-knowledge"

        results = {}
        if (hermes_dir / "MEMORY.md").exists():
            results["memory_imported"] = self.import_memory_md()
        if (hermes_dir / "USER.md").exists():
            results["user_imported"] = self.import_user_md()
        if (hermes_dir / "learnings.md").exists():
            results["learnings_imported"] = self.import_learnings_md()

        return {"success": True, "data": results}
