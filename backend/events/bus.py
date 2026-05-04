# -*- coding: utf-8 -*-
"""Event Bus - Simple in-process pub/sub event system"""

import logging
import threading
from typing import Callable, Any, Optional

logger = logging.getLogger(__name__)


class EventBus:
    """Simple thread-safe in-process event bus"""

    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}
        self._lock = threading.Lock()

    def on(self, event: str, handler: Callable) -> None:
        """Register an event handler"""
        with self._lock:
            if event not in self._handlers:
                self._handlers[event] = []
            self._handlers[event].append(handler)

    def off(self, event: str, handler: Callable) -> None:
        """Unregister an event handler"""
        with self._lock:
            if event in self._handlers:
                self._handlers[event] = [
                    h for h in self._handlers[event] if h != handler
                ]

    def emit(self, event: str, data: Any = None) -> None:
        """Emit an event to all registered handlers (non-blocking)"""
        with self._lock:
            handlers = list(self._handlers.get(event, []))

        for handler in handlers:
            try:
                handler(data)
            except Exception as e:
                logger.debug(f"Event handler error for '{event}': {e}")
                # Never block main flow due to handler errors

    def once(self, event: str, handler: Callable) -> None:
        """Register a one-time event handler"""
        def wrapper(data):
            self.off(event, wrapper)
            handler(data)
        self.on(event, wrapper)

    def listeners(self, event: str) -> int:
        """Return number of listeners for an event"""
        with self._lock:
            return len(self._handlers.get(event, []))

    def clear(self, event: Optional[str] = None) -> None:
        """Clear handlers. If event is None, clear all."""
        with self._lock:
            if event:
                self._handlers.pop(event, None)
            else:
                self._handlers.clear()


# Global singleton
bus = EventBus()
