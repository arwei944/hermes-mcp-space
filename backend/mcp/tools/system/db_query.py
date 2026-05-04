# -*- coding: utf-8 -*-
"""
db_query - 执行 SQL 查询工具
默认只读模式，支持对 Hermes knowledge.db 进行查询
"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="db_query",
        description="Execute SQL queries against configured databases. Read-only by default, rejects INSERT/UPDATE/DELETE/DROP/ALTER when read_only=true.",
        schema={
            "type": "object",
            "properties": {
                "connection_name": {
                    "type": "string",
                    "description": "Database connection name (default: 'knowledge' for knowledge.db)",
                    "default": "knowledge",
                },
                "query": {
                    "type": "string",
                    "description": "SQL query to execute",
                },
                "params": {
                    "type": "array",
                    "description": "Query parameters (optional, for parameterized queries)",
                    "items": {},
                },
                "read_only": {
                    "type": "boolean",
                    "description": "If true, reject write operations (INSERT/UPDATE/DELETE/DROP/ALTER). Default: true",
                    "default": True,
                },
            },
            "required": ["query"],
        },
        handler=handle,
        tags=["system", "database"],
    )


# Write statement prefixes that should be blocked in read-only mode
_WRITE_PREFIXES = ("INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE", "TRUNCATE")


def _is_write_statement(query: str) -> bool:
    """Check if a SQL query is a write statement."""
    stripped = query.strip().upper()
    for prefix in _WRITE_PREFIXES:
        if stripped.startswith(prefix):
            return True
    return False


def _get_db_path(connection_name: str) -> str:
    """Resolve database file path for a given connection name."""
    import os
    from pathlib import Path

    hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    data_dir = Path(hermes_home) / "data"

    # Default: knowledge.db
    if connection_name == "knowledge" or not connection_name:
        return str(data_dir / "knowledge.db")

    # Check db_connections.json for custom connections
    connections_file = data_dir / "db_connections.json"
    if connections_file.exists():
        import json
        with open(connections_file, "r", encoding="utf-8") as f:
            connections = json.load(f)
        for conn in connections:
            if conn.get("name") == connection_name:
                if conn.get("db_type") == "sqlite":
                    return conn.get("connection_string", str(data_dir / "knowledge.db"))
                else:
                    raise ValueError(
                        f"Connection '{connection_name}' is type '{conn.get('db_type')}', "
                        f"but db_query currently only supports SQLite"
                    )

    raise ValueError(f"Database connection '{connection_name}' not found")


def handle(args: dict) -> dict:
    try:
        import sqlite3
        import json

        connection_name = args.get("connection_name", "knowledge")
        query = args.get("query", "").strip()
        params = args.get("params")
        read_only = args.get("read_only", True)

        if not query:
            return error_response("Query cannot be empty")

        # Read-only mode: reject write statements
        if read_only and _is_write_statement(query):
            return error_response(
                f"Write statements are not allowed in read-only mode. "
                f"Detected write prefix in: {query[:50]}..."
            )

        db_path = _get_db_path(connection_name)

        # Ensure database file exists
        import os
        if not os.path.exists(db_path):
            return error_response(f"Database file not found: {db_path}")

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.cursor()

            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)

            # For SELECT queries, return rows as list of dicts
            if query.strip().upper().startswith("SELECT"):
                columns = [description[0] for description in cursor.description] if cursor.description else []
                rows = cursor.fetchall()
                result = [dict(zip(columns, row)) for row in rows]
                return success_response(
                    data={
                        "rows": result,
                        "row_count": len(result),
                        "columns": columns,
                        "connection": connection_name,
                    },
                    message=f"Query executed successfully, {len(result)} rows returned",
                )
            else:
                # For non-SELECT (write) queries
                conn.commit()
                return success_response(
                    data={
                        "rows_affected": cursor.rowcount,
                        "connection": connection_name,
                    },
                    message=f"Query executed successfully, {cursor.rowcount} rows affected",
                )
        finally:
            conn.close()

    except ValueError as e:
        return error_response(str(e))
    except sqlite3.Error as e:
        return error_response(f"SQL error: {str(e)}")
    except Exception as e:
        return error_response(str(e))
