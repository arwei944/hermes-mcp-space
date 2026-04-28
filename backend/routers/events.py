# -*- coding: utf-8 -*-
"""Hermes Agent - SSE 实时事件推送"""

import asyncio
import json
import time
from collections import deque
from typing import Any, Dict, List, Set

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["events"])

# 事件存储（最多保留 200 条，供新连接回放）
_event_buffer: deque = deque(maxlen=200)

# 活跃的 SSE 连接
_subscribers: Set[asyncio.Queue] = set()


def emit_event(event_type: str, data: Any = None, source: str = "system"):
    """发送一个 SSE 事件给所有订阅者"""
    event = {
        "type": event_type,
        "data": data,
        "source": source,
        "timestamp": time.time(),
    }
    _event_buffer.append(event)

    # 推送给所有订阅者
    dead = set()
    for q in _subscribers:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            dead.add(q)
    _subscribers.difference_update(dead)


@router.get("/api/events")
async def sse_stream():
    """SSE 事件流端点"""
    queue = asyncio.Queue(maxsize=50)
    _subscribers.add(queue)

    async def generate():
        try:
            # 先回放最近 5 条事件
            for event in list(_event_buffer)[-5:]:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            # 实时推送
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    # 心跳保活
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            _subscribers.discard(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/events/history")
async def event_history(limit: int = 20):
    """获取最近的事件历史"""
    events = list(_event_buffer)[-limit:]
    return events
