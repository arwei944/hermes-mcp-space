"""
知识条目 CRUD API 路由
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/knowledge/items", tags=["knowledge-items"])


class KnowledgeCreateRequest(BaseModel):
    title: str
    content: str = ""
    summary: str = ""
    category: str = "general"
    tags: List[str] = []
    source: str = "manual"
    source_ref: str = ""
    confidence: float = 0.8


class KnowledgeUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    confidence: Optional[float] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_knowledge(
    category: str = Query(None), is_active: bool = Query(None),
    tags: str = Query(None), confidence_min: float = Query(0),
    limit: int = Query(50, le=200), offset: int = Query(0)
):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    return {"success": True, "data": svc.list_knowledge(
        category=category, is_active=is_active, tags=tag_list,
        confidence_min=confidence_min if confidence_min > 0 else None,
        limit=limit, offset=offset
    )}


@router.get("/search")
async def search_knowledge(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("knowledge", q, limit=limit)}


@router.get("/stats")
async def knowledge_stats():
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    categories = svc._query(
        "SELECT category, COUNT(*) as count, AVG(confidence) as avg_confidence FROM knowledge WHERE is_active=1 GROUP BY category"
    )
    return {"success": True, "data": {"total": len(svc.list_knowledge(is_active=True)), "by_category": categories}}


@router.get("/{knowledge_id}")
async def get_knowledge(knowledge_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.get_knowledge(knowledge_id)
    if not item:
        return {"success": False, "error": f"知识 {knowledge_id} 不存在"}
    return {"success": True, "data": item}


@router.post("")
async def create_knowledge(req: KnowledgeCreateRequest):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.create_knowledge(
        title=req.title, content=req.content, summary=req.summary,
        category=req.category, tags=req.tags, source=req.source,
        source_ref=req.source_ref, confidence=req.confidence, created_by="manual"
    )
    return {"success": True, "data": item}


@router.put("/{knowledge_id}")
async def update_knowledge(knowledge_id: str, req: KnowledgeUpdateRequest):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.update_knowledge(knowledge_id, changed_by="manual",
        title=req.title, content=req.content, summary=req.summary,
        category=req.category, tags=req.tags, confidence=req.confidence,
        is_active=req.is_active)
    if not item:
        return {"success": False, "error": f"知识 {knowledge_id} 不存在"}
    return {"success": True, "data": item}


@router.delete("/{knowledge_id}")
async def delete_knowledge(knowledge_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    return {"success": svc.delete_knowledge(knowledge_id)}
