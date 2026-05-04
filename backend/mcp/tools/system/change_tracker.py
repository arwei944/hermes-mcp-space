# -*- coding: utf-8 -*-
"""Hermes MCP v12.9.0 - Tool: change_tracker

Track and view change history for knowledge entries, with rollback support.
"""

from __future__ import annotations

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg) -> None:
    """Register the change_tracker tool."""
    register_tool(
        reg,
        name="change_tracker",
        description=(
            "Track and view change history for knowledge entries. "
            "Actions: 'history' lists all changes for a target, "
            "'diff' shows old vs new content, 'rollback' restores "
            "a previous version."
        ),
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["history", "rollback", "diff"],
                    "description": "The change-tracking action to perform.",
                },
                "target_type": {
                    "type": "string",
                    "description": "Type of the target entity (e.g. 'knowledge', 'document').",
                },
                "target_id": {
                    "type": "string",
                    "description": "Unique identifier of the target entity.",
                },
                "version": {
                    "type": "string",
                    "description": "Version string to rollback to (required for 'rollback' action).",
                },
            },
            "required": ["action", "target_type", "target_id"],
        },
        handler=handle,
        tags=["system"],
    )


def _load_version_history() -> list[dict]:
    """Read all entries from the version history JSONL file."""
    from pathlib import Path
    from backend.config import get_hermes_home

    log_path = Path(get_hermes_home()) / "data" / "version_history.jsonl"
    if not log_path.exists():
        return []

    import json
    entries: list[dict] = []
    for line in log_path.read_text(encoding="utf-8").strip().splitlines():
        line = line.strip()
        if line:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return entries


def handle(args: dict) -> dict:
    """Handle change_tracker tool invocation.

    Args:
        args: Dict with ``action``, ``target_type``, ``target_id``
              (all required), and optional ``version`` for rollback.

    Returns:
        success_response with the requested change-tracking data.
    """
    try:
        action: str = args["action"]
        target_type: str = args["target_type"]
        target_id: str = args["target_id"]
        version: str | None = args.get("version")

        all_entries = _load_version_history()

        # Filter entries for the given target
        target_entries = [
            e for e in all_entries
            if e.get("target_type") == target_type and e.get("target_id") == target_id
        ]

        if action == "history":
            # Return all changes sorted by timestamp descending
            target_entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
            return success_response(
                data={
                    "target_type": target_type,
                    "target_id": target_id,
                    "total_changes": len(target_entries),
                    "entries": target_entries,
                },
                message=f"Found {len(target_entries)} change records",
            )

        elif action == "diff":
            # Show the most recent old vs new content
            if not target_entries:
                return error_response("No change history found for the specified target")
            latest = target_entries[-1]
            return success_response(
                data={
                    "target_type": target_type,
                    "target_id": target_id,
                    "version": latest.get("version"),
                    "timestamp": latest.get("timestamp"),
                    "changed_by": latest.get("changed_by"),
                    "old_content": latest.get("old_content"),
                    "new_content": latest.get("new_content"),
                    "action": latest.get("action"),
                },
                message="Diff generated for latest change",
            )

        elif action == "rollback":
            if not version:
                return error_response("'version' parameter is required for rollback action")

            # Find the specific version entry
            matched = [
                e for e in target_entries
                if e.get("version") == version
            ]
            if not matched:
                return error_response(
                    f"Version '{version}' not found for target "
                    f"'{target_type}:{target_id}'"
                )

            rollback_entry = matched[0]
            old_content = rollback_entry.get("old_content", "")

            # Attempt to restore via ReviewService
            try:
                from backend.services.review_service import ReviewService

                review_svc = ReviewService()
                review_svc.restore_content(
                    target_type=target_type,
                    target_id=target_id,
                    content=old_content,
                    version=version,
                )
            except ImportError:
                # ReviewService not available -- return content for manual restore
                return success_response(
                    data={
                        "target_type": target_type,
                        "target_id": target_id,
                        "restored_version": version,
                        "content": old_content,
                        "note": "ReviewService unavailable; content returned for manual restore",
                    },
                    message="Rollback content prepared (manual restore required)",
                )

            return success_response(
                data={
                    "target_type": target_type,
                    "target_id": target_id,
                    "restored_version": version,
                    "restored_by": rollback_entry.get("changed_by"),
                },
                message=f"Successfully rolled back to version '{version}'",
            )

        else:
            return error_response(
                f"Unknown action '{action}'. Must be one of: history, diff, rollback"
            )

    except Exception as exc:
        return error_response(str(exc))
