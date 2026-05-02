"""
上下文预算 API
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/context-budget", tags=["context-budget"])


class BudgetUpdateRequest(BaseModel):
    total_budget: Optional[int] = None
    rules_pct: Optional[int] = None
    knowledge_pct: Optional[int] = None
    experience_pct: Optional[int] = None
    memory_pct: Optional[int] = None
    session_pct: Optional[int] = None


@router.get("")
async def get_budget():
    """获取上下文预算配置"""
    from backend.services.context_budget_service import ContextBudgetService
    svc = ContextBudgetService()
    return {"success": True, "data": svc.get_budget()}


@router.put("")
async def update_budget(req: BudgetUpdateRequest):
    """更新上下文预算配置"""
    from backend.services.context_budget_service import ContextBudgetService
    svc = ContextBudgetService()
    # 验证百分比总和不超过 100
    budget = svc.get_budget()
    total_pct = (
        (req.rules_pct if req.rules_pct is not None else budget["rules_pct"]) +
        (req.knowledge_pct if req.knowledge_pct is not None else budget["knowledge_pct"]) +
        (req.experience_pct if req.experience_pct is not None else budget["experience_pct"]) +
        (req.memory_pct if req.memory_pct is not None else budget["memory_pct"]) +
        (req.session_pct if req.session_pct is not None else budget["session_pct"])
    )
    if total_pct > 100:
        return {"success": False, "error": f"百分比总和 {total_pct}% 超过 100%"}

    result = svc.update_budget(
        total_budget=req.total_budget,
        rules_pct=req.rules_pct,
        knowledge_pct=req.knowledge_pct,
        experience_pct=req.experience_pct,
        memory_pct=req.memory_pct,
        session_pct=req.session_pct
    )
    return {"success": True, "data": result}


@router.get("/preview")
async def preview_context(session_id: str = Query(""), query: str = Query("")):
    """预览当前会话的知识上下文"""
    from backend.services.context_budget_service import ContextBudgetService
    svc = ContextBudgetService()
    context = svc.build_context(session_id=session_id, query=query)
    return {"success": True, "data": {"content": context, "char_count": len(context)}}
