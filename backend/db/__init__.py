# -*- coding: utf-8 -*-
"""知识库数据库初始化模块"""

import sqlite3
from pathlib import Path

from backend.config import get_hermes_home

HERMES_HOME = get_hermes_home()
DB_PATH = HERMES_HOME / "data" / "knowledge.db"


def get_knowledge_db() -> sqlite3.Connection:
    """获取知识库数据库连接"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-64000")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_knowledge_db(conn: sqlite3.Connection):
    """初始化知识库数据库"""
    schema_path = Path(__file__).parent / "schema.sql"
    if schema_path.exists():
        conn.executescript(schema_path.read_text(encoding="utf-8"))
    conn.commit()
