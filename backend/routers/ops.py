# -*- coding: utf-8 -*-
"""Hermes Agent - 运维监控 API

提供系统资源监控、MCP 健康状态、工具统计、定时任务监控和告警管理接口。
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.services import ops_service

router = APIRouter(prefix="/api/ops", tags=["ops"])


# ============================================================
# 请求体模型
# ============================================================

class AlertRuleCreateRequest(BaseModel):
    """创建告警规则请求体"""
    name: str = Field(..., description="规则名称")
    type: str = Field(..., description="告警类型: cpu_high, memory_high, disk_high, tool_error_rate, mcp_disconnected")
    threshold: float = Field(..., description="告警阈值")
    enabled: bool = Field(default=True, description="是否启用")
    cooldown: int = Field(default=300, description="冷却时间（秒）")


class AlertRuleUpdateRequest(BaseModel):
    """更新告警规则请求体"""
    name: Optional[str] = Field(default=None, description="规则名称")
    type: Optional[str] = Field(default=None, description="告警类型")
    threshold: Optional[float] = Field(default=None, description="告警阈值")
    enabled: Optional[bool] = Field(default=None, description="是否启用")
    cooldown: Optional[int] = Field(default=None, description="冷却时间（秒）")


# ============================================================
# 系统资源监控
# ============================================================

@router.get("/metrics", summary="实时系统指标")
async def get_metrics() -> Dict[str, Any]:
    """获取当前实时系统指标（CPU/内存/磁盘/网络）"""
    return ops_service.get_system_metrics()


@router.get("/metrics/history", summary="历史指标趋势")
async def get_metrics_history(
    minutes: int = Query(default=10, ge=1, le=60, description="回溯分钟数"),
) -> List[Dict[str, Any]]:
    """获取历史系统指标趋势数据"""
    return ops_service.get_system_history(minutes=minutes)


# ============================================================
# MCP 服务健康监控
# ============================================================

@router.get("/mcp-health", summary="MCP 服务健康状态")
async def get_mcp_health() -> Dict[str, Any]:
    """获取 MCP 服务健康状态，包括成功率、响应时间、错误率趋势"""
    return ops_service.get_mcp_health()


@router.get("/mcp-tools", summary="工具级调用统计")
async def get_mcp_tools() -> List[Dict[str, Any]]:
    """获取按工具分组的调用统计"""
    return ops_service.get_tool_stats()


# ============================================================
# 定时任务监控
# ============================================================

@router.get("/cron", summary="定时任务监控状态")
async def get_cron_monitor() -> Dict[str, Any]:
    """获取定时任务监控状态，包括成功/失败统计"""
    return ops_service.get_cron_monitor()


# ============================================================
# 告警规则管理
# ============================================================

@router.get("/alerts/rules", summary="列出告警规则")
async def list_alert_rules() -> List[Dict[str, Any]]:
    """获取所有告警规则"""
    return ops_service.list_alert_rules()


@router.post("/alerts/rules", summary="创建告警规则")
async def create_alert_rule(request: AlertRuleCreateRequest) -> Dict[str, Any]:
    """创建一条新的告警规则"""
    rule_data = request.model_dump()
    result = ops_service.create_alert_rule(rule_data)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "创建失败"))
    return result


@router.put("/alerts/rules/{rule_id}", summary="更新告警规则")
async def update_alert_rule(rule_id: str, request: AlertRuleUpdateRequest) -> Dict[str, Any]:
    """更新指定告警规则"""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="请提供至少一个要更新的字段")
    result = ops_service.update_alert_rule(rule_id, updates)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.delete("/alerts/rules/{rule_id}", summary="删除告警规则")
async def delete_alert_rule(rule_id: str) -> Dict[str, Any]:
    """删除指定告警规则"""
    result = ops_service.delete_alert_rule(rule_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "删除失败"))
    return result


# ============================================================
# 告警历史与操作
# ============================================================

@router.get("/alerts/history", summary="告警历史")
async def get_alert_history(
    limit: int = Query(default=50, ge=1, le=200, description="返回条数上限"),
) -> List[Dict[str, Any]]:
    """获取告警历史记录（最新的在前）"""
    return ops_service.list_alert_history(limit=limit)


@router.post("/alerts/acknowledge/{alert_id}", summary="确认告警")
async def acknowledge_alert(alert_id: str) -> Dict[str, Any]:
    """确认指定的告警"""
    result = ops_service.acknowledge_alert(alert_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "确认失败"))
    return result


@router.post("/alerts/check", summary="手动触发告警检查")
async def check_alerts() -> Dict[str, Any]:
    """手动触发一次告警规则检查"""
    triggered = ops_service.check_alerts()
    return {
        "checked": True,
        "triggered_count": len(triggered),
        "triggered": triggered,
    }


# ============================================================
# API 错误查询（由 error_tracker 中间件收集）
# ============================================================

@router.get("/api-errors", summary="查询 API 错误列表")
async def list_api_errors(
    status: Optional[int] = Query(default=None, description="按状态码过滤"),
    limit: int = Query(default=50, ge=1, le=200, description="返回条数上限"),
) -> List[Dict[str, Any]]:
    """获取 API 未处理异常列表（最新的在前）"""
    from backend.middleware.error_tracker import get_api_errors
    return get_api_errors(status=status, limit=limit)


@router.get("/api-errors/stats", summary="API 错误统计")
async def api_error_stats() -> Dict[str, Any]:
    """获取 API 错误统计数据"""
    from backend.middleware.error_tracker import get_api_error_stats
    return get_api_error_stats()


# ============================================================
# 聚合概览
# ============================================================

@router.get("/overview", summary="聚合概览数据")
async def get_overview() -> Dict[str, Any]:
    """聚合系统指标、MCP 健康、定时任务、前端错误和 API 错误的概览数据"""
    result: Dict[str, Any] = {}

    # 系统指标
    try:
        result["metrics"] = ops_service.get_system_metrics()
    except Exception as e:
        result["metrics"] = {"error": str(e)}

    # MCP 健康状态
    try:
        result["mcp_health"] = ops_service.get_mcp_health()
    except Exception as e:
        result["mcp_health"] = {"error": str(e)}

    # 定时任务
    try:
        result["cron"] = ops_service.get_cron_monitor()
    except Exception as e:
        result["cron"] = {"error": str(e)}

    # 前端错误统计
    try:
        from backend.routers.frontend_errors import frontend_error_stats
        result["frontend_errors"] = await frontend_error_stats()
    except Exception as e:
        result["frontend_errors"] = {"error": str(e)}

    # API 错误统计
    try:
        from backend.middleware.error_tracker import get_api_error_stats
        result["api_errors"] = get_api_error_stats()
    except Exception as e:
        result["api_errors"] = {"error": str(e)}

    return result
