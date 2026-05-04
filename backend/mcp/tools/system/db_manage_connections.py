# -*- coding: utf-8 -*-
"""
db_manage_connections - 管理数据库连接配置工具
支持列出、添加、删除、测试数据库连接
"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="db_manage_connections",
        description="Manage database connections: list, add, remove, or test connections. Connection configs are stored in db_connections.json.",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "add", "remove", "test"],
                    "description": "Action to perform: list (all connections), add (new connection), remove (a connection), test (connectivity)",
                },
                "name": {
                    "type": "string",
                    "description": "Connection name (required for add/remove/test)",
                },
                "db_type": {
                    "type": "string",
                    "enum": ["sqlite", "mysql", "postgresql"],
                    "description": "Database type (required for add)",
                },
                "connection_string": {
                    "type": "string",
                    "description": "Connection string/path (optional for add, auto-resolved for sqlite)",
                },
            },
            "required": ["action"],
        },
        handler=handle,
        tags=["system", "database"],
    )


def _get_connections_file():
    """Get the path to db_connections.json."""
    import os
    from pathlib import Path

    hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    data_dir = Path(hermes_home) / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "db_connections.json"


def _load_connections():
    """Load connections from JSON file."""
    import json

    conn_file = _get_connections_file()
    if conn_file.exists():
        with open(conn_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_connections(connections):
    """Save connections to JSON file."""
    import json

    conn_file = _get_connections_file()
    with open(conn_file, "w", encoding="utf-8") as f:
        json.dump(connections, f, ensure_ascii=False, indent=2)


def _get_default_sqlite_path():
    """Get the default knowledge.db path."""
    import os
    from pathlib import Path

    hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    return str(Path(hermes_home) / "data" / "knowledge.db")


def handle(args: dict) -> dict:
    try:
        import os
        import sqlite3

        action = args.get("action", "list")
        name = args.get("name", "").strip()
        db_type = args.get("db_type", "").strip()
        connection_string = args.get("connection_string", "").strip()

        if action == "list":
            connections = _load_connections()
            # Always include the default knowledge connection
            default_conn = {
                "name": "knowledge",
                "db_type": "sqlite",
                "connection_string": _get_default_sqlite_path(),
                "is_default": True,
            }
            all_connections = [default_conn] + [
                c for c in connections if c.get("name") != "knowledge"
            ]
            return success_response(
                data={"connections": all_connections, "count": len(all_connections)},
                message=f"Found {len(all_connections)} database connections",
            )

        elif action == "add":
            if not name:
                return error_response("Connection name is required for 'add' action")
            if not db_type:
                return error_response("db_type is required for 'add' action")

            connections = _load_connections()

            # Check for duplicate names
            for c in connections:
                if c.get("name") == name:
                    return error_response(f"Connection '{name}' already exists")

            # Auto-resolve sqlite connection string
            if db_type == "sqlite" and not connection_string:
                connection_string = _get_default_sqlite_path()

            new_conn = {
                "name": name,
                "db_type": db_type,
                "connection_string": connection_string or "",
            }
            connections.append(new_conn)
            _save_connections(connections)

            return success_response(
                data=new_conn,
                message=f"Connection '{name}' added successfully",
            )

        elif action == "remove":
            if not name:
                return error_response("Connection name is required for 'remove' action")

            if name == "knowledge":
                return error_response("Cannot remove the default 'knowledge' connection")

            connections = _load_connections()
            original_count = len(connections)
            connections = [c for c in connections if c.get("name") != name]

            if len(connections) == original_count:
                return error_response(f"Connection '{name}' not found")

            _save_connections(connections)
            return success_response(
                data={"removed": name},
                message=f"Connection '{name}' removed successfully",
            )

        elif action == "test":
            if not name:
                return error_response("Connection name is required for 'test' action")

            # Find connection
            if name == "knowledge":
                conn_info = {
                    "name": "knowledge",
                    "db_type": "sqlite",
                    "connection_string": _get_default_sqlite_path(),
                }
            else:
                connections = _load_connections()
                conn_info = None
                for c in connections:
                    if c.get("name") == name:
                        conn_info = c
                        break
                if not conn_info:
                    return error_response(f"Connection '{name}' not found")

            # Test connectivity
            db_type = conn_info.get("db_type")
            conn_str = conn_info.get("connection_string", "")

            if db_type == "sqlite":
                if not os.path.exists(conn_str):
                    return success_response(
                        data={
                            "connection": name,
                            "status": "warning",
                            "detail": f"Database file does not exist yet: {conn_str}",
                        },
                        message=f"Connection '{name}': file not found (will be created on first use)",
                    )
                try:
                    conn = sqlite3.connect(conn_str)
                    conn.execute("SELECT 1")
                    conn.close()
                    return success_response(
                        data={
                            "connection": name,
                            "status": "ok",
                            "db_type": db_type,
                        },
                        message=f"Connection '{name}' test successful",
                    )
                except Exception as e:
                    return error_response(f"Connection '{name}' test failed: {str(e)}")
            else:
                # For mysql/postgresql, just validate config exists
                if not conn_str:
                    return error_response(
                        f"Connection '{name}': no connection_string configured for {db_type}"
                    )
                return success_response(
                    data={
                        "connection": name,
                        "status": "config_ok",
                        "detail": f"{db_type} connection configured. Runtime test requires {db_type} driver.",
                    },
                    message=f"Connection '{name}' config validated (runtime test not available for {db_type})",
                )

        else:
            return error_response(f"Unknown action: {action}. Use: list, add, remove, test")

    except Exception as e:
        return error_response(str(e))
