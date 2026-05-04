# -*- coding: utf-8 -*-
"""MCP 工具调用中间件管道

v2: 新增 RuleGuardMiddleware — 工具调用前自动检查规则合规性
"""

import asyncio, time, logging, json
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("hermes-mcp")

@dataclass
class Context:
    tool_name: str
    arguments: dict
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
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
    async def execute(self, tool_name: str, arguments: dict, session_id: str = None, registry=None, agent_id: str = None) -> Any:
        ctx = Context(tool_name=tool_name, arguments=arguments, session_id=session_id, agent_id=agent_id, start_time=time.time())
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
            # 记录工具调用追踪（可观测性）
            self._record_trace(ctx)
            return result
        except Exception as e:
            logger.error(f"✗ 工具失败: {ctx.tool_name} — {e}")
            ctx.error = e
            self._record_trace(ctx)
            raise

    def _record_trace(self, ctx: Context):
        """记录工具调用追踪到 tool_call_traces 表"""
        try:
            import uuid
            from backend.db import get_knowledge_db
            conn = get_knowledge_db()
            trace_id = f"trc_{uuid.uuid4().hex[:12]}"
            conn.execute(
                "INSERT INTO tool_call_traces (id, tool_name, arguments, result_success, agent_id, session_id, "
                "matched_rules, injected_hints, auto_learned, duration_ms, error) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    trace_id,
                    ctx.tool_name,
                    json.dumps(ctx.arguments, ensure_ascii=False)[:1000],
                    1 if ctx.error is None else 0,
                    ctx.agent_id or "",
                    ctx.session_id or "",
                    json.dumps(ctx.metadata.get("matched_rules", [])),
                    json.dumps(ctx.metadata.get("context_hints", [])),
                    json.dumps(ctx.metadata.get("auto_learned", [])),
                    ctx.duration_ms,
                    str(ctx.error)[:500] if ctx.error else "",
                ),
            )
            conn.commit()
        except Exception as e:
            logger.debug(f"追踪记录失败: {e}")

class SessionTrackingMiddleware(MiddlewareStep):
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        if ctx.session_id: ctx.metadata["session_id"] = ctx.session_id
        return await next_fn(next_index)

class RuleGuardMiddleware(MiddlewareStep):
    """规则守卫 + 权限检查中间件

    1. 权限检查：基于 Agent 角色检查工具访问权限
    2. safety 类规则：硬性拦截，阻止执行
    3. behavior 类规则：软性警告，附加到结果中提醒 Agent
    4. 工具级 scope 规则：精确匹配特定工具
    """
    def __init__(self, guard_service=None):
        self._guard_service = guard_service

    @property
    def guard(self):
        if self._guard_service is None:
            try:
                from backend.services.rule_guard_service import rule_guard_service
                self._guard_service = rule_guard_service
                logger.info("RuleGuardMiddleware: guard_service lazy-initialized")
            except Exception as e:
                logger.warning(f"RuleGuardMiddleware: failed to init: {e}")
                return None
        return self._guard_service

    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        # --- Step 1: 权限检查 ---
        if ctx.agent_id:
            try:
                from backend.services.permission_service import permission_service
                perm_allowed, perm_reason = permission_service.check_tool_permission(
                    ctx.tool_name, agent_id=ctx.agent_id
                )
                if not perm_allowed:
                    logger.warning(f"🔒 Permission 拒绝: {ctx.tool_name} (agent={ctx.agent_id}) — {perm_reason}")
                    raise ValueError(f"[权限拒绝] {perm_reason}")
            except ValueError:
                raise
            except Exception as e:
                logger.warning(f"Permission check failed: {e}")

        # --- Step 2: 规则守卫检查 ---
        guard = self.guard
        if guard is None:
            return await next_fn(next_index)

        try:
            allowed, block_reason, warnings = guard.check_tool_call(
                ctx.tool_name, ctx.arguments, ctx.agent_id or ""
            )
        except Exception as e:
            logger.warning(f"RuleGuard check failed: {e}")
            return await next_fn(next_index)

        # 硬性拦截
        if not allowed:
            logger.warning(f"🛡️ RuleGuard 拦截: {ctx.tool_name} — {block_reason}")
            raise ValueError(f"[规则守卫] {block_reason}")

        # 软性警告 — 执行工具但附加警告信息
        if warnings:
            ctx.metadata["rule_warnings"] = warnings
            logger.info(f"⚠️ RuleGuard 警告: {ctx.tool_name} — {len(warnings)} 条")

        # --- Step 3: 注入相关经验和知识提醒 ---
        context_hints = self._build_context_hints(ctx.tool_name, ctx.arguments)
        if context_hints:
            ctx.metadata["context_hints"] = context_hints

        result = await next_fn(next_index)

        # 如果有警告或上下文提示，附加到结果中
        extras = {}
        if warnings:
            extras["_rule_warnings"] = warnings
        if context_hints:
            extras["_context_hints"] = context_hints
        if extras and isinstance(result, dict) and result.get("success"):
            existing_data = result.get("data", {})
            if isinstance(existing_data, dict):
                existing_data.update(extras)
            else:
                result.update(extras)

        return result

    def _build_context_hints(self, tool_name: str, arguments: dict) -> List[str]:
        """构建上下文提示：从知识库中查找与当前工具调用相关的经验和知识"""
        hints = []
        try:
            from backend.services.knowledge_service import KnowledgeService
            ks = KnowledgeService()

            # 1. 查找相关经验（同工具的未解决经验）
            experiences = ks.list_experiences(limit=50)
            related_exp = [
                e for e in experiences
                if e.get("tool_name") == tool_name and not e.get("is_resolved")
            ]
            for exp in related_exp[:3]:
                hints.append(f"⚠️ 历史经验: {exp.get('title', '')} — {exp.get('content', '')[:100]}")

            # 2. 查找相关知识（基于参数关键词）
            query_parts = list(arguments.values())[:2]
            query_text = " ".join(str(v) for v in query_parts if isinstance(v, str))[:50]
            if query_text and len(query_text) >= 4:
                knowledge = ks.search_knowledge(query_text, limit=3)
                for kn in knowledge:
                    hints.append(f"📚 相关知识: {kn.get('title', '')} — {kn.get('content', '')[:100]}")

        except Exception as e:
            logger.debug(f"上下文提示构建失败: {e}")

        return hints

class AutoLearnMiddleware(MiddlewareStep):
    """自动知识沉淀中间件 — 每次工具调用后自动提炼知识/经验/记忆写入 DB"""
    def __init__(self, auto_learner=None):
        self._auto_learner = auto_learner
    @property
    def auto_learner(self):
        if self._auto_learner == "lazy":
            try:
                from backend.services.auto_learn_engine import auto_learn_engine
                self._auto_learner = auto_learn_engine
                logger.info("AutoLearnMiddleware: auto_learn_engine lazy-initialized")
            except Exception as e:
                logger.warning(f"AutoLearnMiddleware: failed to init: {e}")
                self._auto_learner = None
        return self._auto_learner
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        result = await next_fn(next_index)
        learner = self.auto_learner
        if learner:
            try:
                # 从工具返回结果中提取摘要
                result_summary = None
                if ctx.result:
                    if isinstance(ctx.result, dict):
                        # 从 MCP 工具返回的 JSON 中提取 message 或 data
                        msg = ctx.result.get("message", "")
                        data = ctx.result.get("data", "")
                        result_summary = str(msg or data or ctx.result)[:1000]
                    else:
                        result_summary = str(ctx.result)[:1000]
                learner.learn_from_tool_call(
                    tool_name=ctx.tool_name,
                    arguments=ctx.arguments,
                    success=ctx.error is None,
                    error=str(ctx.error) if ctx.error else None,
                    result_summary=result_summary,
                    agent_id=ctx.agent_id,
                    session_id=ctx.session_id,
                )
            except Exception as e:
                logger.warning(f"自动沉淀失败: {e}")
        return result

class ErrorHandlingMiddleware(MiddlewareStep):
    async def process(self, ctx: Context, next_fn: Callable, next_index: int) -> Context:
        try: return await next_fn(next_index)
        except ValueError: raise
        except Exception as e:
            logger.error(f"未预期错误 [{ctx.tool_name}]: {e}", exc_info=True)
            raise
