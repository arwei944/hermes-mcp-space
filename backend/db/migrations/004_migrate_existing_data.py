"""
数据迁移脚本 — 将现有 MD 文件和 JSON 数据迁移到 knowledge.db
运行方式：python -m backend.db.migrations.004_migrate_existing_data
"""

import json
import os
from pathlib import Path
from datetime import datetime, timezone

from backend.config import get_hermes_home

HERMES_HOME = get_hermes_home()


def migrate_memory_md(conn):
    """迁移 MEMORY.md → memories 表"""
    memory_md = HERMES_HOME / "memories" / "MEMORY.md"
    if not memory_md.exists():
        print("  ⏭️  MEMORY.md 不存在，跳过")
        return

    content = memory_md.read_text(encoding="utf-8").strip()
    if not content:
        print("  ⏭️  MEMORY.md 为空，跳过")
        return

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    # 按 --- 分割为多条记忆
    entries = content.split("\n\n---\n\n")
    count = 0
    for i, entry in enumerate(entries):
        entry = entry.strip()
        if not entry or len(entry) < 5:
            continue
        title = entry.split("\n")[0][:50].replace("#", "").strip()
        if not title:
            title = f"记忆 #{i+1}"
        conn.execute(
            """INSERT OR IGNORE INTO memories (id, category, title, content, importance, source, created_by, created_at, updated_at)
               VALUES (?, 'agent_memory', ?, ?, 5, 'imported', 'import', ?, ?)""",
            (f"mem_migrated_{i+1:04d}", title, entry, now, now)
        )
        count += 1

    conn.commit()
    print(f"  ✅ 迁移 MEMORY.md → {count} 条记忆")


def migrate_user_md(conn):
    """迁移 USER.md → memories 表"""
    user_md = HERMES_HOME / "memories" / "USER.md"
    if not user_md.exists():
        print("  ⏭️  USER.md 不存在，跳过")
        return

    content = user_md.read_text(encoding="utf-8").strip()
    if not content:
        print("  ⏭️  USER.md 为空，跳过")
        return

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    entries = content.split("\n\n---\n\n")
    count = 0
    for i, entry in enumerate(entries):
        entry = entry.strip()
        if not entry or len(entry) < 5:
            continue
        title = entry.split("\n")[0][:50].replace("#", "").strip()
        if not title:
            title = f"用户画像 #{i+1}"
        conn.execute(
            """INSERT OR IGNORE INTO memories (id, category, title, content, importance, source, created_by, created_at, updated_at)
               VALUES (?, 'user_profile', ?, ?, 5, 'imported', 'import', ?, ?)""",
            (f"mem_user_{i+1:04d}", title, entry, now, now)
        )
        count += 1

    conn.commit()
    print(f"  ✅ 迁移 USER.md → {count} 条记忆")


def migrate_learnings_md(conn):
    """迁移 learnings.md → experiences 表"""
    learnings_md = HERMES_HOME / "learnings.md"
    if not learnings_md.exists():
        print("  ⏭️  learnings.md 不存在，跳过")
        return

    content = learnings_md.read_text(encoding="utf-8").strip()
    if not content:
        print("  ⏭️  learnings.md 为空，跳过")
        return

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    # 按 ## 标题分割
    sections = content.split("\n## ")
    count = 0
    for i, section in enumerate(sections):
        section = section.strip()
        if not section or len(section) < 10:
            continue
        lines = section.split("\n")
        title = lines[0].strip().lstrip("# ").strip()
        body = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

        # 简单分类
        category = "best_practice"
        if "错误" in title or "error" in title.lower() or "失败" in title:
            category = "error_pattern"
        elif "坑" in title or "注意" in title:
            category = "pitfall"
        elif "技巧" in title or "tip" in title.lower():
            category = "tip"

        conn.execute(
            """INSERT OR IGNORE INTO experiences (id, title, content, category, source, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'imported', 'import', ?, ?)""",
            (f"exp_migrated_{i+1:04d}", title, body, category, now, now)
        )
        count += 1

    conn.commit()
    print(f"  ✅ 迁移 learnings.md → {count} 条经验")


def run_migration():
    """执行所有数据迁移"""
    from backend.db import get_knowledge_db, init_knowledge_db

    print("🔄 开始数据迁移...")
    conn = get_knowledge_db()
    init_knowledge_db(conn)

    migrate_memory_md(conn)
    migrate_user_md(conn)
    migrate_learnings_md(conn)

    print("✅ 数据迁移完成！")


if __name__ == "__main__":
    run_migration()
