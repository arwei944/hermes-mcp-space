# -*- coding: utf-8 -*-
"""知识库数据库初始化模块"""

import sqlite3
from pathlib import Path

from backend.config import get_hermes_home

HERMES_HOME = get_hermes_home()
DB_PATH = HERMES_HOME / "data" / "knowledge.db"
_schema_initialized = False


def get_knowledge_db() -> sqlite3.Connection:
    """获取知识库数据库连接，自动确保表结构存在"""
    global _schema_initialized
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-64000")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA foreign_keys=ON")
    # 自动检查并初始化表结构（仅首次或表不存在时执行）
    if not _schema_initialized:
        try:
            _ensure_schema(conn)
            _schema_initialized = True
        except Exception as e:
            import logging
            logging.getLogger("hermes-mcp").error(f"知识库 DB 自动初始化失败: {e}")
    return conn


def _ensure_schema(conn: sqlite3.Connection):
    """检查核心表是否存在，不存在则执行 schema 初始化"""
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rules'"
    )
    if cursor.fetchone() is None:
        init_knowledge_db(conn)


def init_knowledge_db(conn: sqlite3.Connection):
    """初始化知识库数据库（执行 schema.sql）"""
    schema_path = Path(__file__).parent / "schema.sql"
    if schema_path.exists():
        conn.executescript(schema_path.read_text(encoding="utf-8"))
    conn.commit()
