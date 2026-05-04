# -*- coding: utf-8 -*-
"""Hermes MCP v12.9.0 - Middleware: AuditMiddleware

Intercepts all write operations (create / update / delete) and records
them to the audit trail via AuditService.
"""

from __future__ import annotations

import time
from typing import Any, Optional


class AuditMiddleware:
    """Middleware that automatically records write operations to the audit log.

    The middleware inspects incoming tool-call requests and, for any tool
    whose action is classified as a *write* operation (``create``,
    ``update``, or ``delete``), records an audit entry after the tool
    handler has completed.
    """

    # Actions considered "write" operations that should be audited
    WRITE_ACTIONS: set[str] = {"create", "update", "delete", "rollback"}

    def __init__(self) -> None:
        self._service: Optional[Any] = None

    @property
    def service(self) -> Any:
        """Lazy-initialise and return the AuditService singleton."""
        if self._service is None:
            from backend.services.audit_service import AuditService
            self._service = AuditService()
        return self._service

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def process(
        self,
        tool_name: str,
        action: str,
        target_type: str,
        target_id: str,
        handler_fn,
        handler_args: dict,
        session_id: str,
    ) -> dict:
        """Execute a tool handler and optionally audit the result.

        Args:
            tool_name: Name of the MCP tool being invoked.
            action: Action label (e.g. ``"create"``, ``"query"``).
            target_type: Type of the affected entity.
            target_id: Unique identifier of the affected entity.
            handler_fn: The tool handler callable.
            handler_args: Arguments dict forwarded to *handler_fn*.
            session_id: Current session identifier.

        Returns:
            The result dict returned by *handler_fn*.
        """
        start = time.monotonic()
        result = handler_fn(handler_args)
        elapsed_ms = round((time.monotonic() - start) * 1000, 2)

        # Only audit write operations
        if action.lower() in self.WRITE_ACTIONS:
            try:
                outcome = "success" if result.get("success", False) else "error"
                self.service.record(
                    tool_name=tool_name,
                    action=action,
                    target_type=target_type,
                    target_id=target_id,
                    result=outcome,
                    session_id=session_id,
                    duration_ms=elapsed_ms,
                )
            except Exception:
                # Audit failure must never break the tool pipeline
                pass

        return result

    # ------------------------------------------------------------------
    # Convenience: wrap any callable
    # ------------------------------------------------------------------

    def wrap(
        self,
        tool_name: str,
        action: str,
        target_type: str,
        target_id: str,
        session_id: str,
    ):
        """Return a decorator that wraps a handler with audit logging.

        Usage::

            middleware = AuditMiddleware()

            @middleware.wrap(
                tool_name="knowledge_create",
                action="create",
                target_type="knowledge",
                target_id=args["id"],
                session_id=current_session,
            )
            def my_handler(args):
                ...
        """

        def decorator(fn):
            def wrapper(handler_args: dict) -> dict:
                return self.process(
                    tool_name=tool_name,
                    action=action,
                    target_type=target_type,
                    target_id=target_id,
                    handler_fn=fn,
                    handler_args=handler_args,
                    session_id=session_id,
                )
            return wrapper

        return decorator
