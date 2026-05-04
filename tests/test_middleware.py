# -*- coding: utf-8 -*-
"""MCP 中间件管道单元测试

测试范围：
- Pipeline 执行顺序
- RuleCheckEnforcer 规则拦截/通过
- ConversationCaptureMiddleware 缓冲/刷新
- ErrorHandlingMiddleware 错误处理
"""
import asyncio
import pytest
import json
from unittest.mock import MagicMock, patch

from backend.mcp.middleware import (
    Context, MCPMiddlewarePipeline, MiddlewareStep,
    LoggingMiddleware, SessionTrackingMiddleware,
    ErrorHandlingMiddleware, RuleCheckEnforcer,
    ConversationCaptureMiddleware, create_default_pipeline
)


# ============================================================
# 测试辅助
# ============================================================

class MockRegistry:
    """模拟工具注册中心"""
    def __init__(self):
        self.calls = []

    def call(self, name, arguments):
        self.calls.append((name, arguments))
        if name == "error_tool":
            raise RuntimeError("模拟工具错误")
        if name == "value_error_tool":
            raise ValueError("模拟业务错误")
        return {"result": f"{name}_ok", "args": arguments}


class OrderTracker(MiddlewareStep):
    """记录执行顺序的中间件"""
    def __init__(self, order_list):
        self.order_list = order_list

    async def process(self, ctx, next_fn, next_index):
        self.order_list.append(f"before_{self.__class__.__name__}")
        result = await next_fn(next_index)
        self.order_list.append(f"after_{self.__class__.__name__}")
        return result


class BlockingMiddleware(MiddlewareStep):
    """阻止后续执行的中间件（模拟规则拦截）"""
    def __init__(self, block_message="blocked"):
        self.block_message = block_message

    async def process(self, ctx, next_fn, next_index):
        return {"blocked": self.block_message}


# ============================================================
# Pipeline 基础测试
# ============================================================

class TestPipeline:
    """管道基础功能测试"""

    @pytest.mark.asyncio
    async def test_pipeline_execution_order(self):
        """验证中间件按注册顺序执行"""
        order = []
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(OrderTracker(order))
        pipeline.add(OrderTracker(order))
        pipeline.add(OrderTracker(order))

        result = await pipeline.execute(
            tool_name="test_tool",
            arguments={"key": "value"},
            registry=registry
        )

        assert result == {"result": "test_tool_ok", "args": {"key": "value"}}
        assert order == [
            "before_OrderTracker", "before_OrderTracker", "before_OrderTracker",
            "after_OrderTracker", "after_OrderTracker", "after_OrderTracker"
        ]
        assert len(registry.calls) == 1

    @pytest.mark.asyncio
    async def test_pipeline_blocking_middleware(self):
        """验证阻断中间件阻止后续执行"""
        order = []
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(OrderTracker(order))
        pipeline.add(BlockingMiddleware("规则拦截"))
        pipeline.add(OrderTracker(order))

        result = await pipeline.execute(
            tool_name="test_tool",
            arguments={},
            registry=registry
        )

        assert result == {"blocked": "规则拦截"}
        assert len(registry.calls) == 0  # 工具未被调用
        assert order == ["before_OrderTracker"]  # 第三个中间件未执行

    @pytest.mark.asyncio
    async def test_pipeline_stats(self):
        """验证管道统计"""
        pipeline = create_default_pipeline()
        stats = pipeline.stats()
        assert stats["total_steps"] == 6
        assert "RuleCheckEnforcer" in stats["steps"]
        assert "ConversationCaptureMiddleware" in stats["steps"]

    @pytest.mark.asyncio
    async def test_pipeline_remove_middleware(self):
        """验证移除中间件"""
        pipeline = MCPMiddlewarePipeline()
        pipeline.add(LoggingMiddleware())
        pipeline.add(ErrorHandlingMiddleware())
        pipeline.remove(ErrorHandlingMiddleware)
        assert pipeline.stats()["total_steps"] == 1

    @pytest.mark.asyncio
    async def test_pipeline_get_step(self):
        """验证获取中间件实例"""
        pipeline = create_default_pipeline()
        capture = pipeline.get_step(ConversationCaptureMiddleware)
        assert capture is not None
        assert isinstance(capture, ConversationCaptureMiddleware)


# ============================================================
# RuleCheckEnforcer 测试
# ============================================================

class TestRuleCheckEnforcer:
    """规则执行中间件测试"""

    @pytest.mark.asyncio
    async def test_no_rules_passes(self):
        """无规则时所有调用通过"""
        enforcer = RuleCheckEnforcer()
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(enforcer)

        result = await pipeline.execute(
            tool_name="delete_session",
            arguments={},
            registry=registry
        )
        assert result["result"] == "delete_session_ok"

    @pytest.mark.asyncio
    async def test_forbidden_tool_blocked(self):
        """禁止的工具被拦截"""
        enforcer = RuleCheckEnforcer()
        # 直接注入缓存规则（绕过 DB）
        enforcer._rules_cache = [{
            "id": "rule_1",
            "title": "禁止删除会话",
            "content": "禁止调用 delete_session",
            "priority": 10
        }]

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(enforcer)
        registry = MockRegistry()

        result = await pipeline.execute(
            tool_name="delete_session",
            arguments={},
            registry=registry
        )
        assert "error" in result
        assert "禁止删除会话" in result["error"]
        assert len(registry.calls) == 0

    @pytest.mark.asyncio
    async def test_allowed_tool_passes(self):
        """未禁止的工具通过"""
        enforcer = RuleCheckEnforcer()
        enforcer._rules_cache = [{
            "id": "rule_1",
            "title": "禁止删除会话",
            "content": "禁止调用 delete_session",
            "priority": 10
        }]

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(enforcer)
        registry = MockRegistry()

        result = await pipeline.execute(
            tool_name="list_sessions",
            arguments={},
            registry=registry
        )
        assert result["result"] == "list_sessions_ok"

    @pytest.mark.asyncio
    async def test_unless_condition_passes(self):
        """满足例外条件时不拦截"""
        enforcer = RuleCheckEnforcer()
        enforcer._rules_cache = [{
            "id": "rule_1",
            "title": "禁止删除非测试会话",
            "content": "禁止调用 delete_session，除非参数包含 test-",
            "priority": 10
        }]

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(enforcer)
        registry = MockRegistry()

        result = await pipeline.execute(
            tool_name="delete_session",
            arguments={"session_id": "test-12345"},
            registry=registry
        )
        assert result["result"] == "delete_session_ok"

    @pytest.mark.asyncio
    async def test_unless_condition_fails(self):
        """不满足例外条件时拦截"""
        enforcer = RuleCheckEnforcer()
        enforcer._rules_cache = [{
            "id": "rule_1",
            "title": "禁止删除非测试会话",
            "content": "禁止调用 delete_session，除非参数包含 test-",
            "priority": 10
        }]

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(enforcer)
        registry = MockRegistry()

        result = await pipeline.execute(
            tool_name="delete_session",
            arguments={"session_id": "prod-12345"},
            registry=registry
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_multiple_forbidden_tools(self):
        """多个被禁止的工具"""
        enforcer = RuleCheckEnforcer()
        enforcer._rules_cache = [{
            "id": "rule_1",
            "title": "禁止危险操作",
            "content": "禁止调用 delete_session、memory_forget、knowledge_delete",
            "priority": 10
        }]

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(enforcer)
        registry = MockRegistry()

        for tool in ["delete_session", "memory_forget", "knowledge_delete"]:
            result = await pipeline.execute(
                tool_name=tool, arguments={}, registry=registry
            )
            assert "error" in result, f"{tool} 应被拦截"

        # 允许的工具
        result = await pipeline.execute(
            tool_name="list_sessions", arguments={}, registry=registry
        )
        assert "result" in result

    def test_extract_forbidden_tools(self):
        """测试工具名提取"""
        enforcer = RuleCheckEnforcer()

        # 中文顿号分隔
        tools = enforcer._extract_forbidden_tools("禁止调用 delete_session、memory_forget")
        assert "delete_session" in tools
        assert "memory_forget" in tools

        # 无匹配
        tools = enforcer._extract_forbidden_tools("这是一条普通规则")
        assert tools == []


# ============================================================
# ConversationCaptureMiddleware 测试
# ============================================================

class TestConversationCaptureMiddleware:
    """对话捕获中间件测试"""

    @pytest.mark.asyncio
    async def test_capture_without_session(self):
        """无 session_id 时不捕获"""
        capture = ConversationCaptureMiddleware(flush_interval=100)
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(capture)

        result = await pipeline.execute(
            tool_name="test_tool",
            arguments={},
            registry=registry
        )
        assert capture.stats()["total_captured"] == 0

    @pytest.mark.asyncio
    async def test_capture_with_session(self):
        """有 session_id 时捕获"""
        capture = ConversationCaptureMiddleware(flush_interval=100)
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(capture)

        await pipeline.execute(
            tool_name="test_tool",
            arguments={"key": "value"},
            session_id="sess_test123",
            registry=registry
        )
        stats = capture.stats()
        assert stats["total_captured"] == 1
        assert stats["buffered_sessions"] == 1
        assert stats["buffered_messages"] == 1

    @pytest.mark.asyncio
    async def test_auto_flush_at_threshold(self):
        """达到阈值自动刷新"""
        capture = ConversationCaptureMiddleware(flush_interval=3)
        registry = MockRegistry()

        # Mock hermes_service
        with patch("backend.services.hermes_service.hermes_service") as mock_hs:
            mock_hs.add_session_message = MagicMock()

            pipeline = MCPMiddlewarePipeline()
            pipeline.add(capture)

            # 调用 3 次（达到阈值）
            for i in range(3):
                await pipeline.execute(
                    tool_name=f"tool_{i}",
                    arguments={},
                    session_id="sess_auto_flush",
                    registry=registry
                )

            # 第 3 次触发 flush
            assert mock_hs.add_session_message.call_count == 3
            assert capture.stats()["total_flushed"] == 3
            assert capture.stats()["buffered_messages"] == 0

    @pytest.mark.asyncio
    async def test_flush_all(self):
        """手动 flush_all 刷新所有"""
        capture = ConversationCaptureMiddleware(flush_interval=100)
        registry = MockRegistry()

        with patch("backend.services.hermes_service.hermes_service") as mock_hs:
            mock_hs.add_session_message = MagicMock()

            pipeline = MCPMiddlewarePipeline()
            pipeline.add(capture)

            # 调用 2 次（未达到阈值）
            await pipeline.execute(
                tool_name="tool_1", arguments={},
                session_id="sess_manual", registry=registry
            )
            await pipeline.execute(
                tool_name="tool_2", arguments={},
                session_id="sess_manual", registry=registry
            )

            assert capture.stats()["buffered_messages"] == 2

            # 手动 flush
            flushed = capture.flush_all()
            assert flushed == 2
            assert mock_hs.add_session_message.call_count == 2
            assert capture.stats()["buffered_messages"] == 0

    @pytest.mark.asyncio
    async def test_flush_failure_retries(self):
        """刷新失败时放回缓冲区"""
        capture = ConversationCaptureMiddleware(flush_interval=1)
        registry = MockRegistry()

        with patch("backend.services.hermes_service.hermes_service") as mock_hs:
            mock_hs.add_session_message = MagicMock(side_effect=Exception("DB 错误"))

            pipeline = MCPMiddlewarePipeline()
            pipeline.add(capture)

            await pipeline.execute(
                tool_name="tool_1", arguments={},
                session_id="sess_retry", registry=registry
            )

            # 失败后消息应放回缓冲区
            assert capture.stats()["buffered_messages"] == 1

    @pytest.mark.asyncio
    async def test_buffer_overflow_protection(self):
        """缓冲区溢出保护"""
        capture = ConversationCaptureMiddleware(flush_interval=100, max_buffer_size=3)
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(capture)

        # 调用 5 次（超过 max_buffer_size=3）
        for i in range(5):
            await pipeline.execute(
                tool_name=f"tool_{i}", arguments={},
                session_id="sess_overflow", registry=registry
            )

        # 缓冲区不应超过 max_buffer_size
        assert capture.stats()["buffered_messages"] <= 3

    @pytest.mark.asyncio
    async def test_format_entry_includes_error(self):
        """格式化条目包含错误信息"""
        capture = ConversationCaptureMiddleware(flush_interval=100)
        ctx = Context(
            tool_name="error_tool",
            arguments={"key": "val"},
            error=RuntimeError("something went wrong")
        )
        ctx.duration_ms = 123.4

        entry = capture._format_entry(ctx)
        assert "❌" in entry["content"]
        assert "something went wrong" in entry["content"]
        assert "error_tool" in entry["content"]


# ============================================================
# ErrorHandlingMiddleware 测试
# ============================================================

class TestErrorHandlingMiddleware:
    """错误处理中间件测试"""

    @pytest.mark.asyncio
    async def test_value_error_passes_through(self):
        """ValueError 直接透传"""
        pipeline = MCPMiddlewarePipeline()
        pipeline.add(ErrorHandlingMiddleware())
        registry = MockRegistry()

        with pytest.raises(ValueError):
            await pipeline.execute(
                tool_name="value_error_tool",
                arguments={},
                registry=registry
            )

    @pytest.mark.asyncio
    async def test_runtime_error_is_caught(self):
        """RuntimeError 被捕获并重新抛出"""
        pipeline = MCPMiddlewarePipeline()
        pipeline.add(ErrorHandlingMiddleware())
        registry = MockRegistry()

        with pytest.raises(RuntimeError):
            await pipeline.execute(
                tool_name="error_tool",
                arguments={},
                registry=registry
            )


# ============================================================
# SessionTrackingMiddleware 测试
# ============================================================

class TestSessionTrackingMiddleware:
    """会话追踪中间件测试"""

    @pytest.mark.asyncio
    async def test_session_id_in_metadata(self):
        """session_id 注入到 metadata"""
        tracker = SessionTrackingMiddleware()
        registry = MockRegistry()

        pipeline = MCPMiddlewarePipeline()
        pipeline.add(tracker)

        # 需要一个能返回 context 的方式
        # 由于 pipeline.execute 不返回 context，我们直接测试 process
        ctx = Context(tool_name="test", arguments={}, session_id="sess_123")
        await tracker.process(ctx, lambda idx: asyncio.sleep(0) or {"ok": True}, 1)
        assert ctx.metadata["session_id"] == "sess_123"

    @pytest.mark.asyncio
    async def test_no_session_id(self):
        """无 session_id 时不注入"""
        tracker = SessionTrackingMiddleware()
        ctx = Context(tool_name="test", arguments={})
        await tracker.process(ctx, lambda idx: asyncio.sleep(0) or {"ok": True}, 1)
        assert "session_id" not in ctx.metadata


# ============================================================
# create_default_pipeline 测试
# ============================================================

class TestCreateDefaultPipeline:
    """默认管道创建测试"""

    def test_default_pipeline_has_all_steps(self):
        """默认管道包含所有 6 个中间件"""
        pipeline = create_default_pipeline()
        stats = pipeline.stats()
        assert stats["total_steps"] == 6
        expected = [
            "RuleCheckEnforcer",
            "LoggingMiddleware",
            "SessionTrackingMiddleware",
            "ErrorHandlingMiddleware",
            "AutoLearnMiddleware",
            "ConversationCaptureMiddleware"
        ]
        assert stats["steps"] == expected

    def test_default_pipeline_order(self):
        """验证中间件顺序正确"""
        pipeline = create_default_pipeline()
        steps = pipeline.steps
        assert isinstance(steps[0], RuleCheckEnforcer)
        assert isinstance(steps[-1], ConversationCaptureMiddleware)
