# -*- coding: utf-8 -*-
"""MCP 工具调用中间件管道

责任链模式实现，支持前置拦截和后置处理。
中间件按注册顺序执行，每个 step 可决定是否继续传递。
"""
import asyncio
import time
import logging
import json
import threading
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("hermes-mcp")


@dataclass
class Context:
    """工具调用上下文 — 贯穿整个中间件链"""
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
    """中间件基类 — 子类实现 process() 方法"""
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        return await next_fn(next_index)


class MCPMiddlewarePipeline:
    """MCP 中间件管道 — 责任链模式"""

    def __init__(self):
        self._steps: List[MiddlewareStep] = []

    def add(self, step: MiddlewareStep) -> 'MCPMiddlewarePipeline':
        """追加中间件（支持链式调用）"""
        self._steps.append(step)
        return self

    def insert(self, index: int, step: MiddlewareStep):
        """在指定位置插入中间件"""
        self._steps.insert(index, step)

    def remove(self, step_class: type):
        """按类型移除中间件"""
        self._steps = [s for s in self._steps if not isinstance(s, step_class)]

    def get_step(self, step_class: type) -> Optional[MiddlewareStep]:
        """获取指定类型的中间件实例"""
        for s in self._steps:
            if isinstance(s, step_class):
                return s
        return None

    @property
    def steps(self) -> List[MiddlewareStep]:
        return list(self._steps)

    async def execute(self, tool_name: str, arguments: dict,
                      session_id: str = None, registry=None) -> Any:
        """执行中间件链，最终调用实际工具"""
        ctx = Context(
            tool_name=tool_name,
            arguments=arguments,
            session_id=session_id,
            start_time=time.time()
        )

        async def build_chain(index: int):
            if index >= len(self._steps):
                result = registry.call(ctx.tool_name, ctx.arguments)
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

    def stats(self) -> dict:
        """返回管道统计信息"""
        return {
            "total_steps": len(self._steps),
            "steps": [type(s).__name__ for s in self._steps]
        }


# ============================================================
# 内置中间件
# ============================================================

class LoggingMiddleware(MiddlewareStep):
    """日志中间件 — 记录工具调用的入参和出参"""

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
    """会话追踪中间件 — 将 session_id 注入 metadata"""

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        if ctx.session_id:
            ctx.metadata["session_id"] = ctx.session_id
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
                learner.learn_from_tool_call(
                    tool_name=ctx.tool_name,
                    arguments=ctx.arguments,
                    success=ctx.error is None,
                    error=str(ctx.error) if ctx.error else None,
                    result_summary=str(ctx.result)[:500] if ctx.result else None
                )
            except Exception as e:
                logger.warning(f"自动学习失败: {e}")
        return result


class ErrorHandlingMiddleware(MiddlewareStep):
    """错误处理中间件 — 捕获未预期异常"""

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        try:
            return await next_fn(next_index)
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"未预期错误 [{ctx.tool_name}]: {e}", exc_info=True)
            raise


# ============================================================
# 新增中间件 — Phase 1: 行为控制系统
# ============================================================

class RuleCheckEnforcer(MiddlewareStep):
    """
    规则执行中间件 — 工具调用前检查活跃规则

    检查逻辑：
    1. 从 knowledge.db 的 rules 表加载 scope='tool_guard' 的活跃规则
    2. 对规则 content 进行模式匹配（工具名、参数关键词）
    3. 违反时直接返回错误，不执行工具
    """

    def __init__(self):
        self._rules_cache: List[dict] = []
        self._cache_time: float = 0
        self._cache_ttl: float = 60
        self._lock = threading.Lock()

    def _load_guard_rules(self) -> List[dict]:
        """加载工具守护规则（带缓存 + double-check locking）"""
        now = time.time()
        if now - self._cache_time < self._cache_ttl:
            return self._rules_cache
        with self._lock:
            if now - self._cache_time < self._cache_ttl:
                return self._rules_cache
            try:
                from backend.db import get_knowledge_db
                conn = get_knowledge_db()
                rows = conn.execute(
                    "SELECT id, title, content, priority FROM rules "
                    "WHERE is_active = 1 AND scope = 'tool_guard' "
                    "ORDER BY priority DESC"
                ).fetchall()
                self._rules_cache = [dict(r) for r in rows]
                self._cache_time = now
                logger.debug(f"RuleCheckEnforcer: 加载 {len(self._rules_cache)} 条守护规则")
            except Exception as e:
                logger.warning(f"RuleCheckEnforcer: 加载守护规则失败: {e}")
        return self._rules_cache

    def _check_violation(self, tool_name: str, arguments: dict, rule: dict) -> bool:
        """检查工具调用是否违反规则"""
        content = rule.get("content", "")
        content_lower = content.lower()

        # 模式 1: 明确禁止特定工具名
        forbidden_tools = self._extract_forbidden_tools(content_lower)
        if tool_name.lower() in forbidden_tools:
            if "除非" in content_lower:
                condition = content.split("除非")[1].strip()
                args_str = json.dumps(arguments, ensure_ascii=False)
                if condition in args_str:
                    return False
            return True

        # 模式 2: 参数关键词禁止
        if "参数包含" in content_lower and "禁止" in content_lower:
            keyword = content_lower.split("参数包含")[1].split("时")[0].strip().strip('"').strip("'")
            args_str = json.dumps(arguments, ensure_ascii=False).lower()
            if keyword in args_str:
                return True

        return False

    def _extract_forbidden_tools(self, content: str) -> List[str]:
        """从规则内容中提取被禁止的工具名列表"""
        tools = []
        for prefix in ["禁止调用", "禁止使用", "不允许调用", "不允许使用"]:
            if prefix in content:
                after = content.split(prefix, 1)[1]
                for sep in ["、", "，", ",", "。", "\n", ";"]:
                    if sep in after:
                        after = after.split(sep)[0]
                        break
                for name in after.replace(" ", "").split("、"):
                    name = name.strip()
                    if name:
                        tools.append(name)
        return tools

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        rules = self._load_guard_rules()
        for rule in rules:
            if self._check_violation(ctx.tool_name, ctx.arguments, rule):
                logger.warning(
                    f"RuleCheckEnforcer: 拦截 {ctx.tool_name} "
                    f"(规则: {rule['title']}, 优先级: {rule.get('priority', 0)})"
                )
                ctx.error = ValueError(f"规则违反: {rule['title']}")
                return {
                    "error": f"规则违反: {rule['title']}",
                    "rule_id": rule["id"],
                    "tool_name": ctx.tool_name
                }
        return await next_fn(next_index)


class ConversationCaptureMiddleware(MiddlewareStep):
    """
    对话捕获中间件 — 自动记录 MCP 交互到 Hermes 会话

    策略：
    - 每次 MCP 工具调用后，将调用信息缓冲
    - 每 flush_interval 次调用批量写入
    - 会话结束时通过 flush_all() 强制写入
    - 写入失败时静默降级，不影响用户体验
    """

    def __init__(self, flush_interval: int = 5, max_buffer_size: int = 100):
        self._buffer: Dict[str, list] = {}
        self._flush_interval = flush_interval
        self._max_buffer_size = max_buffer_size
        self._lock = threading.Lock()
        self._total_captured = 0
        self._total_flushed = 0

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        result = await next_fn(next_index)

        session_id = (
            ctx.metadata.get("hermes_session_id")
            or ctx.metadata.get("session_id")
            or ctx.session_id
        )
        if not session_id:
            return result

        entry = self._format_entry(ctx)
        with self._lock:
            self._buffer.setdefault(session_id, []).append(entry)
            self._total_captured += 1

            if len(self._buffer[session_id]) > self._max_buffer_size:
                self._buffer[session_id] = self._buffer[session_id][-self._flush_interval:]

            if len(self._buffer[session_id]) >= self._flush_interval:
                messages = self._buffer.pop(session_id, [])
            else:
                messages = None

        if messages:
            self._flush(session_id, messages)

        return result

    def _format_entry(self, ctx: Context) -> dict:
        """格式化单条工具调用记录"""
        status = "❌" if ctx.error else "✅"
        args_preview = json.dumps(ctx.arguments, ensure_ascii=False)[:300]
        result_preview = str(ctx.result)[:500] if ctx.result else "(无结果)"

        content = (
            f"**{ctx.tool_name}** {status}\n"
            f"参数: `{args_preview}`\n"
            f"结果: {result_preview}\n"
            f"耗时: {ctx.duration_ms:.0f}ms"
        )
        if ctx.error:
            content += f"\n错误: `{str(ctx.error)[:200]}`"

        return {
            "role": "tool_call",
            "content": content,
            "timestamp": time.time()
        }

    def _flush(self, session_id: str, messages: list):
        """批量写入 Hermes 会话"""
        if not messages:
            return
        try:
            from backend.services.hermes_service import hermes_service
            for msg in messages:
                hermes_service.add_session_message(
                    session_id=session_id,
                    role=msg["role"],
                    content=msg["content"]
                )
            with self._lock:
                self._total_flushed += len(messages)
            logger.debug(
                f"ConversationCapture: 刷新 {len(messages)} 条消息 "
                f"到会话 {session_id[:16]}..."
            )
        except Exception as e:
            logger.warning(f"ConversationCapture: 刷新失败: {e}")
            with self._lock:
                self._buffer.setdefault(session_id, []).extend(messages)

    def flush_all(self) -> int:
        """强制刷新所有缓冲区（会话结束时调用）"""
        total = 0
        with self._lock:
            all_buffers = dict(self._buffer)
            self._buffer.clear()
        for session_id, messages in all_buffers.items():
            self._flush(session_id, messages)
            total += len(messages)
        if total:
            logger.info(f"ConversationCapture: flush_all 刷新 {total} 条消息")
        return total

    def stats(self) -> dict:
        """返回捕获统计"""
        with self._lock:
            return {
                "total_captured": self._total_captured,
                "total_flushed": self._total_flushed,
                "buffered_sessions": len(self._buffer),
                "buffered_messages": sum(len(m) for m in self._buffer.values())
            }


# ============================================================
# 便捷函数
# ============================================================

def create_default_pipeline() -> MCPMiddlewarePipeline:
    """创建默认中间件管道（推荐顺序）"""
    pipeline = MCPMiddlewarePipeline()
    pipeline.add(RuleCheckEnforcer())
    pipeline.add(LoggingMiddleware())
    pipeline.add(SessionTrackingMiddleware())
    pipeline.add(ErrorHandlingMiddleware())
    pipeline.add(AutoLearnMiddleware("lazy"))
    pipeline.add(ConversationCaptureMiddleware())
    return pipeline
