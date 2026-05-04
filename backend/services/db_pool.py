# -*- coding: utf-8 -*-
"""
db_pool - 数据库连接管理服务
读取 db_connections.json，提供 get_connection(name) 方法
当前 MVP 阶段仅支持 SQLite
"""

import os
import json
import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any


class DBPool:
    """Simple database connection manager for SQLite."""

    def __init__(self):
        self._connections_file: Optional[Path] = None
        self._configs: Dict[str, Dict[str, Any]] = {}
        self._default_name = "knowledge"

    @property
    def connections_file(self) -> Path:
        """Lazy-resolve the connections file path."""
        if self._connections_file is None:
            hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
            data_dir = Path(hermes_home) / "data"
            data_dir.mkdir(parents=True, exist_ok=True)
            self._connections_file = data_dir / "db_connections.json"
        return self._connections_file

    def _get_default_db_path(self) -> str:
        """Get the default knowledge.db path."""
        hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
        return str(Path(hermes_home) / "data" / "knowledge.db")

    def reload(self) -> None:
        """Reload connection configs from JSON file."""
        if self.connections_file.exists():
            with open(self.connections_file, "r", encoding="utf-8") as f:
                self._configs = json.load(f)
        else:
            self._configs = {}

    def list_connections(self) -> list:
        """List all configured connections including the default."""
        self.reload()
        connections = [
            {
                "name": self._default_name,
                "db_type": "sqlite",
                "connection_string": self._get_default_db_path(),
                "is_default": True,
            }
        ]
        for name, config in self._configs.items():
            if name != self._default_name:
                connections.append(config)
        return connections

    def get_connection(self, name: str = "knowledge") -> sqlite3.Connection:
        """
        Get a SQLite connection by name.

        Args:
            name: Connection name. Defaults to 'knowledge'.

        Returns:
            sqlite3.Connection object.

        Raises:
            ValueError: If connection not found or type not supported.
            sqlite3.Error: If connection fails.
        """
        self.reload()

        if name == self._default_name or not name:
            db_path = self._get_default_db_path()
        else:
            config = self._configs.get(name)
            if not config:
                raise ValueError(f"Database connection '{name}' not found")
            if config.get("db_type") != "sqlite":
                raise ValueError(
                    f"Connection '{name}' is type '{config.get('db_type')}', "
                    f"only SQLite is supported in MVP"
                )
            db_path = config.get("connection_string", "")
            if not db_path:
                raise ValueError(f"Connection '{name}' has no connection_string")

        # Ensure parent directory exists
        db_dir = Path(db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def execute_query(
        self,
        query: str,
        params: Optional[list] = None,
        connection_name: str = "knowledge",
        read_only: bool = True,
    ) -> Dict[str, Any]:
        """
        Execute a SQL query and return results.

        Args:
            query: SQL query string.
            params: Optional query parameters.
            connection_name: Database connection name.
            read_only: If True, reject write statements.

        Returns:
            Dict with 'rows', 'row_count', 'columns' for SELECT,
            or 'rows_affected' for write queries.
        """
        write_prefixes = (
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
            "CREATE", "REPLACE", "TRUNCATE",
        )
        stripped = query.strip().upper()
        is_write = any(stripped.startswith(p) for p in write_prefixes)

        if read_only and is_write:
            raise ValueError(
                f"Write statements are not allowed in read-only mode: {query[:50]}..."
            )

        conn = self.get_connection(connection_name)
        try:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)

            if stripped.startswith("SELECT"):
                columns = (
                    [d[0] for d in cursor.description]
                    if cursor.description else []
                )
                rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
                return {
                    "rows": rows,
                    "row_count": len(rows),
                    "columns": columns,
                }
            else:
                conn.commit()
                return {"rows_affected": cursor.rowcount}
        finally:
            conn.close()


# Module-level singleton
_pool: Optional[DBPool] = None


def get_pool() -> DBPool:
    """Get the global DBPool instance."""
    global _pool
    if _pool is None:
        _pool = DBPool()
    return _pool


def get_connection(name: str = "knowledge") -> sqlite3.Connection:
    """Shortcut to get a connection from the global pool."""
    return get_pool().get_connection(name)
