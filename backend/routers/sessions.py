# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 会话管理 API

提供会话的增删改查接口。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", summary="列出所有会话")
async def list_sessions() -> List[Dict[str, Any]]:
    """获取所有会话列表，按更新时间倒序排列"""
    return hermes_service.list_sessions()


@router.post("", summary="创建会话")
async def create_session(body: Dict[str, str] = None) -> Dict[str, Any]:
    """创建新会话"""
    body = body or {}
    return hermes_service.create_session(
        title=body.get("title", ""),
        model=body.get("model", ""),
        source=body.get("source", "api"),
    )


@router.get("/{session_id}", summary="获取会话详情")
async def get_session(session_id: str) -> Dict[str, Any]:
    """根据 ID 获取会话详情"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    return session


@router.get("/{session_id}/messages", summary="获取会话消息")
async def get_session_messages(session_id: str) -> List[Dict[str, Any]]:
    """获取指定会话的所有消息，按时间正序排列"""
    # 先验证会话是否存在
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    return hermes_service.get_session_messages(session_id)


@router.delete("/{session_id}", summary="删除会话")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """删除指定会话及其所有消息"""
    success = hermes_service.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在或删除失败")
    return {"success": True, "message": f"会话 {session_id} 已删除"}


@router.post("/{session_id}/compress", summary="压缩会话上下文")
async def compress_session(session_id: str) -> Dict[str, Any]:
    """压缩指定会话的上下文，减少 token 消耗"""
    result = hermes_service.compress_session(session_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "压缩失败"))
    return result
