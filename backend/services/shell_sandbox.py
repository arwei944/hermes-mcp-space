# -*- coding: utf-8 -*-
"""Hermes MCP v12.9.0 - Shell Sandbox Service

Provides safe shell command execution with blacklist-based security filtering.
"""

from __future__ import annotations

import re
import subprocess
from typing import Optional


class ShellSandbox:
    """Sandboxed shell command executor with safety restrictions.

    All commands are checked against a blacklist of dangerous patterns
    before execution. Matching commands are rejected with a descriptive
    error message.
    """

    BLACKLIST_PATTERNS: list[str] = [
        r"rm\s+-rf\s+/",          # recursive root delete
        r"mkfs",                   # format filesystem
        r"dd\s+if=",               # disk write
        r":\(\)\s*\{",             # fork bomb
        r"(shutdown|reboot|halt)\b",  # system shutdown
        r"chmod\s+777",            # world-writable
        r">\s*/dev/sd",            # direct disk write
        r"(wget|curl)\s+.*\|\s*(sh|bash)",  # remote script pipe
    ]

    def check_command(self, command: str) -> tuple[bool, str]:
        """Check whether a command is safe to execute.

        Args:
            command: The shell command string to validate.

        Returns:
            A tuple of (is_safe, reason). When *is_safe* is ``False``,
            *reason* contains a human-readable explanation of why the
            command was blocked.
        """
        for pattern in self.BLACKLIST_PATTERNS:
            if re.search(pattern, command):
                return False, f"Command matches blacklist pattern: {pattern}"
        return True, ""

    def execute(
        self,
        command: str,
        timeout: int = 30,
        cwd: Optional[str] = None,
    ) -> dict:
        """Execute a shell command after safety validation.

        Args:
            command: The shell command to run.
            timeout: Maximum execution time in seconds (default 30).
            cwd: Working directory for the command (optional).

        Returns:
            A dict with keys ``stdout``, ``stderr``, ``returncode``,
            and ``timed_out``.

        Raises:
            ValueError: If the command matches a blacklist pattern.
            subprocess.TimeoutExpired: If the command exceeds *timeout*.
        """
        is_safe, reason = self.check_command(command)
        if not is_safe:
            raise ValueError(f"Command blocked: {reason}")

        timed_out = False
        try:
            result = subprocess.run(
                command,
                shell=True,
                timeout=timeout,
                capture_output=True,
                text=True,
                cwd=cwd,
            )
        except subprocess.TimeoutExpired as exc:
            timed_out = True
            result = exc  # type: ignore[assignment]

        return {
            "stdout": getattr(result, "stdout", "") or "",
            "stderr": getattr(result, "stderr", "") or "",
            "returncode": getattr(result, "returncode", -1),
            "timed_out": timed_out,
        }
