# -*- coding: utf-8 -*-
"""Hermes Agent - 插件管理 API"""

from fastapi import APIRouter, HTTPException
from typing import Any, Dict

from backend.services.plugin_service import plugin_service

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


@router.get("", summary="列出所有插件")
async def list_plugins() -> Dict[str, Any]:
    return {"plugins": plugin_service.list_plugins()}


@router.post("/install", summary="安装插件")
async def install_plugin(body: Dict[str, str]) -> Dict[str, Any]:
    source = body.get("source", "")
    if not source:
        raise HTTPException(status_code=400, detail="请提供 source（Git 仓库 URL）")
    result = plugin_service.install_plugin(source)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "安装失败"))
    return result


@router.delete("/{name}", summary="卸载插件")
async def uninstall_plugin(name: str) -> Dict[str, Any]:
    result = plugin_service.uninstall_plugin(name)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "卸载失败"))
    return result


@router.get("/tools", summary="获取插件提供的工具")
async def get_plugin_tools() -> Dict[str, Any]:
    return {"tools": plugin_service.get_plugin_tools()}


@router.get("/skills", summary="获取插件提供的技能")
async def get_plugin_skills() -> Dict[str, Any]:
    return {"skills": plugin_service.get_plugin_skills()}


@router.get("/memory", summary="获取插件提供的记忆模板")
async def get_plugin_memory() -> Dict[str, Any]:
    content = plugin_service.get_plugin_memory()
    return {"memory": content}
