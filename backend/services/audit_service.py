# -*- coding: utf-8 -*-
"""Hermes MCP v12.9.0 - Audit Service

Records and queries operation audit trails stored in JSONL format.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Generator, Optional


class AuditService:
    """Persistent audit-log service backed by a JSONL file.

    Each audit entry is a JSON object appended as a single line to
    ``{HERMES_HOME}/data/audit.jsonl``.
    """

    def __init__(self) -> None:
        from backend.config import get_hermes_home  # lazy import

        self._log_path: Path = Path(get_hermes_home()) / "data" / "audit.jsonl"
        self._log_path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def record(
        self,
        tool_name: str,
        action: str,
        target_type: str,
        target_id: str,
        result: str,
        session_id: str,
        duration_ms: float,
    ) -> dict:
        """Append a single audit entry to the JSONL log.

        Args:
            tool_name: Name of the MCP tool that was invoked.
            action: High-level action label (e.g. ``"create"``, ``"update"``).
            target_type: Type of the affected entity.
            target_id: Unique identifier of the affected entity.
            result: Outcome of the operation (e.g. ``"success"`` / ``"error"``).
            session_id: Identifier of the session that triggered the action.
            duration_ms: Wall-clock duration of the tool call in milliseconds.

        Returns:
            The audit entry that was written.
        """
        entry: dict[str, Any] = {
            "timestamp": datetime.now().isoformat(),
            "tool_name": tool_name,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "result": result,
            "session_id": session_id,
            "duration_ms": duration_ms,
        }
        with open(self._log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return entry

    # ------------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------------

    def _iter_entries(self) -> Generator[dict[str, Any], None, None]:
        """Yield parsed JSON objects from the audit log (newest first)."""
        if not self._log_path.exists():
            return
        lines = self._log_path.read_text(encoding="utf-8").strip().splitlines()
        for line in reversed(lines):
            line = line.strip()
            if line:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue

    @staticmethod
    def _parse_iso(value: Optional[str]) -> Optional[datetime]:
        """Best-effort ISO-8601 parser."""
        if not value:
            return None
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.fromisoformat(value) if "T" in value else datetime.strptime(value, fmt)
            except (ValueError, TypeError):
                continue
        return None

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def query(
        self,
        limit: int = 50,
        tool_name: Optional[str] = None,
        action_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Query the audit log with optional filters.

        Args:
            limit: Maximum number of entries to return (default 50).
            tool_name: Filter by tool name (exact match).
            action_type: Filter by action type (exact match).
            date_from: Inclusive lower bound as ISO-8601 string.
            date_to: Inclusive upper bound as ISO-8601 string.

        Returns:
            A list of audit entries sorted by timestamp descending.
        """
        dt_from = self._parse_iso(date_from)
        dt_to = self._parse_iso(date_to)

        results: list[dict[str, Any]] = []
        for entry in self._iter_entries():
            # Apply filters
            if tool_name and entry.get("tool_name") != tool_name:
                continue
            if action_type and entry.get("action") != action_type:
                continue
            if dt_from:
                entry_ts = self._parse_iso(entry.get("timestamp", ""))
                if entry_ts and entry_ts < dt_from:
                    continue
            if dt_to:
                entry_ts = self._parse_iso(entry.get("timestamp", ""))
                if entry_ts and entry_ts > dt_to:
                    continue
            results.append(entry)
            if len(results) >= limit:
                break
        return results

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def stats(
        self,
        tool_name: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> dict[str, Any]:
        """Return aggregate statistics over the audit log.

        Returns:
            A dict with ``total``, ``by_tool``, ``by_action``, and
            ``avg_duration_ms``.
        """
        entries = self.query(limit=100_000, tool_name=tool_name, date_from=date_from, date_to=date_to)
        by_tool: dict[str, int] = {}
        by_action: dict[str, int] = {}
        total_duration = 0.0
        duration_count = 0

        for entry in entries:
            tn = entry.get("tool_name", "unknown")
            by_tool[tn] = by_tool.get(tn, 0) + 1
            act = entry.get("action", "unknown")
            by_action[act] = by_action.get(act, 0) + 1
            dur = entry.get("duration_ms")
            if dur is not None:
                total_duration += float(dur)
                duration_count += 1

        return {
            "total": len(entries),
            "by_tool": by_tool,
            "by_action": by_action,
            "avg_duration_ms": round(total_duration / duration_count, 2) if duration_count else 0,
        }

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def export(
        self,
        tool_name: Optional[str] = None,
        action_type: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> str:
        """Export filtered audit entries as a JSON string.

        Returns:
            A JSON array string of matching audit entries.
        """
        entries = self.query(
            limit=100_000,
            tool_name=tool_name,
            action_type=action_type,
            date_from=date_from,
            date_to=date_to,
        )
        return json.dumps(entries, ensure_ascii=False, indent=2)
