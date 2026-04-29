# -*- coding: utf-8 -*-
"""Hermes Agent - Evals API 路由

提供工具调用追踪数据的查询接口。
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Query

from backend.services import eval_service

router = APIRouter(tags=["evals"])


@router.get("/evals/summary", summary="获取 Evals 总览")
async def eval_summary() -> Dict[str, Any]:
    """返回总调用数、成功率、平均延迟等汇总信息"""
    return eval_service.get_eval_summary()


@router.get("/evals/tools", summary="按工具分组的统计")
async def eval_tools() -> List[Dict[str, Any]]:
    """返回每个工具的调用次数、成功率、平均延迟"""
    return eval_service.get_tool_stats()


@router.get("/evals/errors", summary="错误模式分析")
async def eval_errors() -> List[Dict[str, Any]]:
    """返回 Top 5 失败工具及其失败原因"""
    return eval_service.get_error_patterns()


@router.get("/evals/trend", summary="调用趋势")
async def eval_trend(
    days: int = Query(default=7, ge=1, le=90, description="回溯天数"),
) -> List[Dict[str, Any]]:
    """返回过去 N 天的调用趋势（按日期分组）"""
    return eval_service.get_trend(days)
