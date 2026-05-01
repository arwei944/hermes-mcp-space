# -*- coding: utf-8 -*-
"""Hermes Agent - SSE 实时事件推送"""

import asyncio
import json
import logging
import os
import time
from collections import deque
from typing import Any, Dict, List, Set

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

logger = logging.getLogger("hermes-mcp")

router = APIRouter(tags=["events"])

# 事件存储（最多保留 200 条，供新连接回放）
_event_buffer: deque = deque(maxlen=200)

# 活跃的 SSE 连接
_subscribers: Set[asyncio.Queue] = set()

# 心跳间隔（秒）- 远程环境下 15 秒保活
_SSE_HEARTBEAT_INTERVAL = 15


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
async def sse_stream(
    request: Request,
    token: str = Query(None, description="可选的认证 token"),
):
    """SSE 事件流端点"""
    # Token 验证（如果配置了 AUTH_TOKEN）
    auth_token = os.environ.get("AUTH_TOKEN", "")
    if auth_token and token != auth_token:
        raise HTTPException(status_code=401, detail="Invalid token")

    queue = asyncio.Queue(maxsize=50)
    _subscribers.add(queue)

    async def generate():
        try:
            # 先回放最近 5 条事件
            for event in list(_event_buffer)[-5:]:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

            # 实时推送 + 心跳保活
            while True:
                try:
                    event = await asyncio.wait_for(
                        queue.get(), timeout=_SSE_HEARTBEAT_INTERVAL
                    )
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    # SSE 标准心跳：以冒号开头的行作为注释，客户端会忽略
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            logger.debug("SSE 连接已取消")
        except Exception as e:
            logger.warning(f"SSE 连接异常断开: {e}")
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
