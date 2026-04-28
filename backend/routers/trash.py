# -*- coding: utf-8 -*-
"""Hermes Agent - 回收站 API"""

from fastapi import APIRouter, HTTPException
from typing import Any, Dict

from backend.services.trash_service import (
    list_trash,
    restore_item,
    permanent_delete,
    empty_trash,
    move_to_trash,
)

router = APIRouter(prefix="/api/trash", tags=["trash"])


@router.post("", summary="移到回收站")
async def add_to_trash(body: Dict[str, Any]) -> Dict[str, Any]:
    result = move_to_trash(
        item_type=body.get("type", ""),
        item_id=body.get("item_id", ""),
        item_name=body.get("item_name", ""),
        item_data=body.get("data"),
        metadata=body.get("metadata"),
    )
    return result


@router.get("", summary="列出回收站")
async def get_trash(type: str = "") -> Dict[str, Any]:
    return {"items": list_trash(type)}


@router.post("/restore/{trash_id}", summary="恢复项目")
async def restore(trash_id: str) -> Dict[str, Any]:
    result = restore_item(trash_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message"))
    return result


@router.delete("/{trash_id}", summary="永久删除")
async def perm_delete(trash_id: str) -> Dict[str, Any]:
    result = permanent_delete(trash_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message"))
    return result


@router.delete("", summary="清空回收站")
async def clear_trash() -> Dict[str, Any]:
    return empty_trash()
