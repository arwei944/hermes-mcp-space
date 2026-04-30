# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 记忆管理 API

提供 Hermes Agent 记忆的读取和更新接口。
"""

from typing import Any, Dict, Optional

from fastapi import APIRouter

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/memory", tags=["memory"])


class MemoryUpdateRequest:
    """记忆更新请求体（内联定义以减少依赖）"""
    pass


@router.get("", summary="读取当前记忆")
async def read_memory() -> Dict[str, Any]:
    """
    读取 Hermes Agent 的当前记忆内容

    Returns:
        包含 memory（MEMORY.md）和 user（USER.md）内容的字典
    """
    return hermes_service.read_memory()


@router.put("", summary="更新记忆")
async def update_memory(body: Dict[str, Optional[str]]) -> Dict[str, Any]:
    """
    更新 Hermes Agent 的记忆文件

    Args:
        body: 包含 memory 和/或 user 字段的字典

    支持部分更新，只传需要更新的字段即可。
    """
    memory_content = body.get("memory")
    user_content = body.get("user")

    if memory_content is None and user_content is None:
        return {"success": False, "message": "请提供至少一个要更新的字段（memory 或 user）"}

    return hermes_service.update_memory(
        memory=memory_content,
        user=user_content,
    )
