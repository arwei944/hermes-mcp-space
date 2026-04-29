# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 截图工具 API

提供网页截图的捕获、列表、查看和删除接口。
"""

import os
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from backend.services.screenshot_service import screenshot_service

router = APIRouter(tags=["screenshot"])


@router.post("/api/screenshot/capture", summary="截取网页截图")
async def capture(body: Dict[str, Any]) -> Dict[str, Any]:
    """接收 URL 参数，调用截图服务生成截图"""
    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL 不能为空")

    width = body.get("width", 1280)
    height = body.get("height", 720)
    full_page = body.get("full_page", False)

    result = await screenshot_service.capture(url, width=width, height=height, full_page=full_page)
    return result


@router.get("/api/screenshots", summary="列出所有截图")
async def list_screenshots() -> List[Dict[str, Any]]:
    """获取所有截图的元数据列表"""
    return screenshot_service.list_all()


@router.get("/api/screenshots/{filename}", summary="获取截图详情")
async def get_screenshot(filename: str) -> Dict[str, Any]:
    """根据文件名获取截图的详细信息"""
    info = screenshot_service.get_info(filename)
    if not info:
        raise HTTPException(status_code=404, detail=f"截图 {filename} 不存在")
    return info


@router.delete("/api/screenshots/{filename}", summary="删除截图")
async def delete_screenshot(filename: str) -> Dict[str, Any]:
    """删除指定截图文件"""
    return screenshot_service.delete(filename)
