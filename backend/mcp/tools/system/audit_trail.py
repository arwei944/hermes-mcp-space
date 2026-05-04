# -*- coding: utf-8 -*-
"""Hermes MCP v12.9.0 - Tool: audit_trail

Query, aggregate, and export operation audit trails.
"""

from __future__ import annotations

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg) -> None:
    """Register the audit_trail tool."""
    register_tool(
        reg,
        name="audit_trail",
        description=(
            "Query the operation audit trail. Supports three actions: "
            "'query' returns filtered log entries, 'stats' returns "
            "aggregate statistics, and 'export' returns a full JSON "
            "export of matching entries."
        ),
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["query", "stats", "export"],
                    "description": "The audit action to perform.",
                },
                "limit": {
                    "type": "number",
                    "description": "Maximum number of entries to return (default 50).",
                    "default": 50,
                },
                "tool_name": {
                    "type": "string",
                    "description": "Filter by tool name (exact match, optional).",
                },
                "action_type": {
                    "type": "string",
                    "description": "Filter by action type (exact match, optional).",
                },
                "date_from": {
                    "type": "string",
                    "description": "Inclusive lower bound as ISO-8601 date/time (optional).",
                },
                "date_to": {
                    "type": "string",
                    "description": "Inclusive upper bound as ISO-8601 date/time (optional).",
                },
            },
            "required": ["action"],
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """Handle audit_trail tool invocation.

    Args:
        args: Dict with ``action`` (required), and optional filters
              ``limit``, ``tool_name``, ``action_type``, ``date_from``,
              ``date_to``.

    Returns:
        success_response with the requested audit data.
    """
    try:
        action: str = args["action"]
        limit: int = int(args.get("limit", 50))
        tool_name: str | None = args.get("tool_name")
        action_type: str | None = args.get("action_type")
        date_from: str | None = args.get("date_from")
        date_to: str | None = args.get("date_to")

        from backend.services.audit_service import AuditService

        service = AuditService()

        if action == "query":
            data = service.query(
                limit=limit,
                tool_name=tool_name,
                action_type=action_type,
                date_from=date_from,
                date_to=date_to,
            )
            return success_response(
                data={"entries": data, "count": len(data)},
                message=f"Returned {len(data)} audit entries",
            )

        elif action == "stats":
            data = service.stats(
                tool_name=tool_name,
                date_from=date_from,
                date_to=date_to,
            )
            return success_response(
                data=data,
                message="Audit statistics computed",
            )

        elif action == "export":
            export_json = service.export(
                tool_name=tool_name,
                action_type=action_type,
                date_from=date_from,
                date_to=date_to,
            )
            return success_response(
                data={"export": export_json},
                message="Audit log exported",
            )

        else:
            return error_response(
                f"Unknown action '{action}'. Must be one of: query, stats, export"
            )

    except Exception as exc:
        return error_response(str(exc))
