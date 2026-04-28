# -*- coding: utf-8 -*-
"""Hermes Agent - 插件管理 API（含市场）"""

import json
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from backend.services.plugin_service import plugin_service, install_builtin

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

_PLUGIN_INDEX_PATH = Path(__file__).parent.parent / "data" / "plugin_index.json"


def _load_index() -> list:
    """加载内置插件索引"""
    if _PLUGIN_INDEX_PATH.exists():
        try:
            return json.loads(_PLUGIN_INDEX_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


@router.get("", summary="列出已安装插件")
async def list_installed() -> Dict[str, Any]:
    return {"plugins": plugin_service.list_plugins()}


@router.get("/market", summary="浏览插件市场")
async def browse_market(
    category: str = Query("", description="分类筛选"),
    type: str = Query("", description="类型筛选: tool/skill/memory"),
    keyword: str = Query("", description="搜索关键词"),
) -> Dict[str, Any]:
    """浏览插件市场（内置索引 + 已安装状态）"""
    index = _load_index()
    installed = plugin_service.list_plugins()
    installed_names = {p.get("name") for p in installed}

    # 筛选
    if category:
        index = [p for p in index if p.get("category") == category]
    if type:
        index = [p for p in index if p.get("type") == type]
    if keyword:
        kw = keyword.lower()
        index = [p for p in index if
            kw in p.get("name", "").lower() or
            kw in p.get("description", "").lower() or
            any(kw in t.lower() for t in p.get("tags", []))
        ]

    # 标记安装状态
    for p in index:
        p["installed"] = p.get("name") in installed_names

    # 分类统计
    categories = {}
    for p in _load_index():
        cat = p.get("category", "其他")
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "plugins": index,
        "categories": categories,
        "total": len(index),
    }


@router.get("/market/{name}", summary="获取插件详情")
async def get_plugin_detail(name: str) -> Dict[str, Any]:
    index = _load_index()
    plugin = next((p for p in index if p.get("name") == name), None)
    if not plugin:
        raise HTTPException(status_code=404, detail=f"插件 {name} 不存在")

    installed = plugin_service.list_plugins()
    plugin["installed"] = any(p.get("name") == name for p in installed)
    return plugin


@router.post("/install", summary="安装插件")
async def install_plugin(body: Dict[str, str]) -> Dict[str, Any]:
    source = body.get("source", "")
    name = body.get("name", "")
    if not source and not name:
        raise HTTPException(status_code=400, detail="请提供 source（Git URL）或 name（插件名）")

    # 如果只提供了 name，从索引查找 git_url
    if name and not source:
        index = _load_index()
        plugin = next((p for p in index if p.get("name") == name), None)
        if plugin:
            source = plugin.get("git_url", "")
        if not source:
            # 内置插件，创建本地插件目录
            result = install_builtin(name, plugin)
            return result
        if not source:
            raise HTTPException(status_code=400, detail=f"插件 {name} 无安装源")

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
