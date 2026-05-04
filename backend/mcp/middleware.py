# -*- coding: utf-8 -*-
"""MCP 工具调用中间件管道"""

import asyncio, time, logging, json
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("hermes-mcp")

@dataclass
class Context:
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
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        return await next_fn(next_index)

class MCPMiddlewarePipeline:
    def __init__(self):
        self._steps: List[MiddlewareStep] = []
    def add(self, step: MiddlewareStep): self._steps.append(step); return self
    def insert(self, index: int, step: MiddlewareStep): self._steps.insert(index, step)
    def remove(self, step_class: type): self._steps = [s for s in self._steps if not isinstance(s, step_class)]
    async def execute(self, tool_name: str, arguments: dict, session_id: str = None, registry=None) -> Any:
        ctx = Context(tool_name=tool_name, arguments=arguments, session_id=session_id, start_time=time.time())
        async def build_chain(index: int):
            if index >= len(self._steps):
                result = registry.call(ctx.tool_name, ctx.arguments)
                if asyncio.iscoroutine(result): result = await result
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
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        if ctx.session_id: ctx.metadata["session_id"] = ctx.session_id
        return await next_fn(next_index)

class AutoLearnMiddleware(MiddlewareStep):
    """自动学习中间件 — 成功和失败调用都触发学习"""
    def __init__(self, auto_learner=None):
        self._auto_learner = auto_learner
    @property
    def auto_learner(self):
        if self._auto_learner == "lazy":
            try:
                from backend.services.auto_learner import AutoLearner
                self._auto_learner = AutoLearner()
                logger.info("AutoLearnMiddleware: auto_learner lazy-initialized")
            except Exception as e:
                logger.warning(f"AutoLearnMiddleware: failed to init: {e}")
                self._auto_learner = None
        return self._auto_learner
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        result = await next_fn(next_index)
        learner = self.auto_learner
        if learner:
            try:
                learner.learn_from_tool_call(tool_name=ctx.tool_name, arguments=ctx.arguments,
                    success=ctx.error is None, error=str(ctx.error) if ctx.error else None,
                    result_summary=str(ctx.result)[:500] if ctx.result else None)
            except Exception as e:
                logger.warning(f"自动学习失败: {e}")
        return result

class ErrorHandlingMiddleware(MiddlewareStep):
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        try: return await next_fn(next_index)
        except ValueError: raise
        except Exception as e:
            logger.error(f"未预期错误 [{ctx.tool_name}]: {e}", exc_info=True)
            raise