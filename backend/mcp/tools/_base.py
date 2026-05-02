# -*- coding: utf-8 -*-
"""
工具模块基类和工具函数
每个积木块工具模块都应使用这些工具来简化开发
"""

from functools import wraps
from typing import Any, Callable, Dict, List, Optional


def tool(
    name: str,
    description: str,
    schema: dict,
    tags: Optional[list] = None,
):
    """
    工具装饰器 — 简化工具注册

    使用方式:
        @tool("list_sessions", "列出会话", {...}, tags=["session"])
        async def handle(args: dict) -> dict:
            ...
    """
    def decorator(func: Callable):
        func._tool_meta = {
            "name": name,
            "description": description,
            "input_schema": schema,
            "tags": tags or [],
        }
        return func
    return decorator


def register_tool(registry, name: str, description: str, schema: dict,
                  handler: Callable, tags: Optional[List[str]] = None):
    """
    工具注册快捷函数

    使用方式:
        def register(reg):
            register_tool(reg, "list_sessions", "列出会话",
                          {...}, handle, tags=["session"])
    """
    registry.register(
        name=name,
        description=description,
        schema=schema,
        handler=handler,
        tags=tags or [],
    )


def success_response(data: Any = None, message: str = "success") -> dict:
    """构造成功响应"""
    return {
        "success": True,
        "message": message,
        "data": data,
    }


def error_response(message: str, code: str = "ERROR") -> dict:
    """构造错误响应"""
    return {
        "success": False,
        "message": message,
        "error_code": code,
    }


def paginate(items: list, page: int = 1, page_size: int = 20) -> dict:
    """分页工具"""
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "total": len(items),
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (len(items) + page_size - 1) // page_size),
    }


def safe_json_serialize(obj: Any) -> str:
    """安全 JSON 序列化（处理非标准类型）"""
    import json
    from datetime import datetime, date

    def default(o):
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        if hasattr(o, "__dict__"):
            return str(o)
        return str(o)

    return json.dumps(obj, ensure_ascii=False, default=default)
