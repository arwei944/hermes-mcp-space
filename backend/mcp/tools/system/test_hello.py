# -*- coding: utf-8 -*-
"""
测试工具模块 — 验证 ToolRegistry 自动发现和调用
Phase 0 集成测试用，Phase 1 开始后可删除
"""

from backend.mcp.tools._base import register_tool, success_response


def register(reg):
    register_tool(
        reg,
        name="test_hello",
        description="测试工具 — 验证 ToolRegistry 自动发现",
        schema={
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "要打招呼的名字",
                    "default": "World",
                }
            },
        },
        handler=handle,
        tags=["system", "test"],
    )


def handle(args: dict) -> dict:
    """测试处理函数"""
    name = args.get("name", "World")
    return success_response({"greeting": f"Hello, {name}!"})
