# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 技能管理 API

提供技能的增删改查接口。
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/skills", tags=["skills"])


class SkillCreateRequest(BaseModel):
    """创建技能请求体"""
    name: str = Field(..., description="技能名称", min_length=1, max_length=100)
    content: str = Field(default="", description="SKILL.md 内容")
    description: str = Field(default="", description="技能描述")
    tags: List[str] = Field(default_factory=list, description="标签列表")


class SkillUpdateRequest(BaseModel):
    """更新技能请求体"""
    content: str = Field(default="", description="SKILL.md 内容")
    description: str = Field(default="", description="技能描述")
    tags: Optional[List[str]] = Field(default=None, description="标签列表")


@router.get("", summary="列出所有技能")
async def list_skills() -> List[Dict[str, Any]]:
    """获取所有已安装的技能列表"""
    return hermes_service.list_skills()


@router.get("/{skill_name}", summary="获取技能详情")
async def get_skill(skill_name: str) -> Dict[str, Any]:
    """获取指定技能的详细信息，包含 SKILL.md 内容和文件列表"""
    skill = hermes_service.get_skill(skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail=f"技能 {skill_name} 不存在")
    return skill


@router.post("", summary="创建新技能")
async def create_skill(request: SkillCreateRequest) -> Dict[str, Any]:
    """创建一个新的技能目录和 SKILL.md 文件"""
    # 验证技能名称安全性（防止路径注入）
    import re
    if not re.match(r'^[a-zA-Z0-9_\-\u4e00-\u9fff]+$', request.name):
        raise HTTPException(
            status_code=400,
            detail="技能名称只能包含字母、数字、下划线、连字符和中文字符",
        )

    result = hermes_service.create_skill(request.name, request.content, request.description, request.tags)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "创建失败"))
    return result


@router.put("/{skill_name}", summary="更新技能")
async def update_skill(skill_name: str, request: SkillUpdateRequest) -> Dict[str, Any]:
    """更新指定技能的 SKILL.md 内容"""
    result = hermes_service.update_skill(skill_name, request.content, request.description, request.tags)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.delete("/{skill_name}", summary="删除技能")
async def delete_skill(skill_name: str) -> Dict[str, Any]:
    """删除指定技能及其所有文件"""
    result = hermes_service.delete_skill(skill_name)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "删除失败"))
    return result
