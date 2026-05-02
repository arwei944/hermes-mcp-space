"""
经验 CRUD API 路由
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/experiences", tags=["experiences"])


class ExperienceCreateRequest(BaseModel):
    title: str
    content: str = ""
    category: str = "best_practice"
    context: str = ""
    tool_name: str = ""
    error_type: str = ""
    severity: str = "medium"
    tags: List[str] = []


class ExperienceUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_resolved: Optional[bool] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_experiences(
    category: str = Query(None), severity: str = Query(None),
    is_resolved: bool = Query(None), tool_name: str = Query(None),
    limit: int = Query(50, le=200), offset: int = Query(0)
):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    return {"success": True, "data": svc.list_experiences(
        category=category, severity=severity, is_resolved=is_resolved,
        tool_name=tool_name, limit=limit, offset=offset
    )}


@router.get("/search")
async def search_experiences(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("experiences", q, limit=limit)}


@router.get("/stats")
async def experience_stats():
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    categories = svc._query(
        "SELECT category, COUNT(*) as count FROM experiences WHERE is_active=1 GROUP BY category"
    )
    severity = svc._query(
        "SELECT severity, COUNT(*) as count FROM experiences WHERE is_active=1 GROUP BY severity"
    )
    return {"success": True, "data": {"total": len(svc.list_experiences(is_active=True)), "by_category": categories, "by_severity": severity}}


@router.get("/{exp_id}")
async def get_experience(exp_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.get_experience(exp_id)
    if not item:
        return {"success": False, "error": f"经验 {exp_id} 不存在"}
    return {"success": True, "data": item}


@router.post("")
async def create_experience(req: ExperienceCreateRequest):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.create_experience(
        title=req.title, content=req.content, category=req.category,
        context=req.context, tool_name=req.tool_name, error_type=req.error_type,
        severity=req.severity, tags=req.tags, created_by="manual"
    )
    return {"success": True, "data": item}


@router.put("/{exp_id}")
async def update_experience(exp_id: str, req: ExperienceUpdateRequest):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.update_experience(exp_id, changed_by="manual",
        title=req.title, content=req.content, category=req.category,
        is_resolved=req.is_resolved, tags=req.tags, is_active=req.is_active)
    if not item:
        return {"success": False, "error": f"经验 {exp_id} 不存在"}
    return {"success": True, "data": item}


@router.put("/{exp_id}/resolve")
async def resolve_experience(exp_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.resolve_experience(exp_id, changed_by="manual")
    if not item:
        return {"success": False, "error": f"经验 {exp_id} 不存在"}
    return {"success": True, "data": item}


@router.delete("/{exp_id}")
async def delete_experience(exp_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    return {"success": svc.delete_experience(exp_id)}
