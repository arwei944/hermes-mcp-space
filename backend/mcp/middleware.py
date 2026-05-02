# -*- coding: utf-8 -*-
"""
MCP 工具调用中间件管道
将横切关注点从 mcp_endpoint() 中提取为可插拔的中间件链
"""

import asyncio
import time
import logging
import json
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("hermes-mcp")


@dataclass
class Context:
    """中间件上下文 — 在管道中传递的状态"""
    tool_name: str
    arguments: dict
    session_id: Optional[str] = None
    result: Any = None
    error: Optional[Exception] = None
    start_time: float = 0.0
    end_time: float = 0.0
    duration_ms: float = 0.0
    metadata: Dict = field(default_factory=dict)


class MiddlewareStep:
    """中间件步骤基类"""

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        """处理中间件步骤，调用 next_fn(next_index) 传递给下一步"""
        return await next_fn(next_index)


class MCPMiddlewarePipeline:
    """MCP 中间件管道"""

    def __init__(self):
        self._steps: List[MiddlewareStep] = []

    def add(self, step: MiddlewareStep) -> "MCPMiddlewarePipeline":
        """添加中间件步骤"""
        self._steps.append(step)
        return self

    def insert(self, index: int, step: MiddlewareStep):
        """在指定位置插入中间件步骤"""
        self._steps.insert(index, step)

    def remove(self, step_class: type):
        """移除指定类型的中间件"""
        self._steps = [s for s in self._steps if not isinstance(s, step_class)]

    async def execute(self, tool_name: str, arguments: dict,
                      session_id: str = None, registry=None) -> Any:
        """执行完整的中间件管道"""
        ctx = Context(
            tool_name=tool_name,
            arguments=arguments,
            session_id=session_id,
            start_time=time.time(),
        )

        async def build_chain(index: int):
            if index >= len(self._steps):
                result = registry.call(ctx.tool_name, ctx.arguments)
                # 如果 handler 返回 coroutine，自动 await
                if asyncio.iscoroutine(result):
                    result = await result
                return result
            return await self._steps[index].process(ctx, build_chain, index + 1)

        try:
            result = await build_chain(0)
            ctx.result = result
        except Exception as e:
            ctx.error = e
            logger.error(f"工具调用失败 [{ctx.tool_name}]: {e}")
            raise
        finally:
            ctx.end_time = time.time()
            ctx.duration_ms = (ctx.end_time - ctx.start_time) * 1000

        return ctx.result


class LoggingMiddleware(MiddlewareStep):
    """请求/响应日志中间件"""

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        args_preview = json.dumps(ctx.arguments, ensure_ascii=False)[:200]
        logger.info(f"→ 工具调用: {ctx.tool_name} args={args_preview}")
        try:
            result = await next_fn(next_index)
            logger.info(f"← 工具完成: {ctx.tool_name} ({ctx.duration_ms:.0f}ms)")
            return result
        except Exception as e:
            logger.error(f"✗ 工具失败: {ctx.tool_name} — {e}")
            raise


class SessionTrackingMiddleware(MiddlewareStep):
    """会话追踪中间件"""

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        if ctx.session_id:
            ctx.metadata["session_id"] = ctx.session_id
        return await next_fn(next_index)


class AutoLearnMiddleware(MiddlewareStep):
    """自动学习中间件"""

    def __init__(self, auto_learner=None):
        self.auto_learner = auto_learner

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        result = await next_fn(next_index)
        if self.auto_learner and ctx.error is None:
            try:
                await self.auto_learner.learn_from_tool_call(
                    ctx.tool_name, ctx.arguments, ctx.result
                )
            except Exception as e:
                logger.warning(f"自动学习失败: {e}")
        return result


class ErrorHandlingMiddleware(MiddlewareStep):
    """错误处理中间件 — 统一错误格式"""

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        try:
            return await next_fn(next_index)
        except ValueError as e:
            raise
        except Exception as e:
            logger.error(f"未预期错误 [{ctx.tool_name}]: {e}", exc_info=True)
            raise
