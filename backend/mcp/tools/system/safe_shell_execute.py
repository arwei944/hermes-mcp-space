# -*- coding: utf-8 -*-
"""Hermes MCP v12.9.0 - Tool: safe_shell_execute

Execute shell commands with safety restrictions enforced by ShellSandbox.
"""

from __future__ import annotations

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg) -> None:
    """Register the safe_shell_execute tool."""
    register_tool(
        reg,
        name="safe_shell_execute",
        description=(
            "Execute a shell command with safety restrictions. "
            "Dangerous patterns (e.g. rm -rf /, mkfs, fork bombs, "
            "remote script pipes) are blocked by a blacklist policy."
        ),
        schema={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute.",
                },
                "timeout": {
                    "type": "number",
                    "description": "Execution timeout in seconds (default 30).",
                    "default": 30,
                },
                "working_dir": {
                    "type": "string",
                    "description": "Working directory for the command (optional).",
                },
            },
            "required": ["command"],
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """Handle safe_shell_execute tool invocation.

    Args:
        args: Dict with keys ``command``, ``timeout`` (optional), and
              ``working_dir`` (optional).

    Returns:
        success_response with ``stdout``, ``stderr``, ``returncode``,
        ``timed_out`` on success; error_response on failure.
    """
    try:
        command: str = args["command"]
        timeout: int = int(args.get("timeout", 30))
        working_dir: str | None = args.get("working_dir")

        from backend.services.shell_sandbox import ShellSandbox

        sandbox = ShellSandbox()
        result = sandbox.execute(
            command=command,
            timeout=timeout,
            cwd=working_dir,
        )

        return success_response(
            data=result,
            message=f"Command executed (exit code {result['returncode']})",
        )
    except ValueError as exc:
        return error_response(f"Command blocked by safety policy: {exc}")
    except Exception as exc:
        return error_response(str(exc))
