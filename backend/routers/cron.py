# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 定时任务 API

提供定时任务的增删改查接口。
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/cron", tags=["cron"])


class CronJobCreateRequest(BaseModel):
    """创建定时任务请求体"""
    name: str = Field(..., description="任务名称")
    schedule: str = Field(..., description="Cron 表达式，如 '0 9 * * *'")
    command: str = Field(..., description="要执行的命令或任务描述")
    enabled: bool = Field(default=True, description="是否启用")
    description: str = Field(default="", description="任务描述")


class CronJobUpdateRequest(BaseModel):
    """更新定时任务请求体"""
    name: Optional[str] = Field(default=None, description="任务名称")
    schedule: Optional[str] = Field(default=None, description="Cron 表达式")
    command: Optional[str] = Field(default=None, description="要执行的命令")
    enabled: Optional[bool] = Field(default=None, description="是否启用")
    description: Optional[str] = Field(default=None, description="任务描述")


@router.get("/jobs", summary="列出所有定时任务")
async def list_cron_jobs() -> List[Dict[str, Any]]:
    """获取所有定时任务列表"""
    return hermes_service.list_cron_jobs()


@router.get("/jobs/{job_id}", summary="获取定时任务详情")
async def get_cron_job(job_id: str) -> Dict[str, Any]:
    """获取指定定时任务的详细信息"""
    job = hermes_service.get_cron_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"任务 {job_id} 不存在")
    return job


@router.post("/jobs", summary="创建定时任务")
async def create_cron_job(request: CronJobCreateRequest) -> Dict[str, Any]:
    """创建一个新的定时任务"""
    job_data = request.model_dump()
    result = hermes_service.create_cron_job(job_data)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "创建失败"))
    return result


@router.put("/jobs/{job_id}", summary="更新定时任务")
async def update_cron_job(job_id: str, request: CronJobUpdateRequest) -> Dict[str, Any]:
    """更新指定定时任务的配置"""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="请提供至少一个要更新的字段")

    result = hermes_service.update_cron_job(job_id, updates)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.delete("/jobs/{job_id}", summary="删除定时任务")
async def delete_cron_job(job_id: str) -> Dict[str, Any]:
    """删除指定的定时任务"""
    result = hermes_service.delete_cron_job(job_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "删除失败"))
    return result


@router.get("/jobs/{job_id}/output", summary="获取任务输出")
async def get_cron_job_output(job_id: str) -> Dict[str, Any]:
    """获取指定定时任务的执行输出日志"""
    output = hermes_service.get_cron_job_output(job_id)
    if not output:
        raise HTTPException(status_code=404, detail=f"任务 {job_id} 的输出不存在")
    return output


@router.post("/jobs/{job_id}/trigger", summary="手动触发定时任务")
async def trigger_cron_job(job_id: str) -> Dict[str, Any]:
    """手动触发执行指定的定时任务"""
    result = hermes_service.trigger_cron_job(job_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "触发失败"))
    return result
