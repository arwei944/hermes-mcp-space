"""
记忆 CRUD API 路由
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/memories", tags=["memories"])


class MemoryCreateRequest(BaseModel):
    content: str
    category: str = "agent_memory"
    title: str = ""
    importance: int = 5
    expires_at: str = ""
    tags: List[str] = []


class MemoryUpdateRequest(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    importance: Optional[int] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    expires_at: Optional[str] = None


@router.get("")
async def list_memories(
    category: str = Query(None), is_active: bool = Query(None),
    importance_min: int = Query(0), limit: int = Query(50, le=200),
    offset: int = Query(0)
):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    return {"success": True, "data": svc.list_memories(
        category=category, is_active=is_active,
        importance_min=importance_min if importance_min > 0 else None,
        limit=limit, offset=offset
    )}


@router.get("/search")
async def search_memories(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("memories", q, limit=limit)}


@router.get("/export/{category}")
async def export_memories(category: str = "agent_memory"):
    """导出记忆为 Markdown 格式"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    items = svc.list_memories(category=category, limit=100)
    md = "\n\n---\n\n".join(item["content"] for item in items)
    return {"success": True, "content": md, "count": len(items), "category": category}


@router.get("/stats")
async def memory_stats():
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    categories = svc._query(
        "SELECT category, COUNT(*) as count, AVG(importance) as avg_importance FROM memories WHERE is_active=1 GROUP BY category"
    )
    return {"success": True, "data": {"total": len(svc.list_memories(is_active=True)), "by_category": categories}}


@router.get("/{mem_id}")
async def get_memory(mem_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.get_memory(mem_id)
    if not item:
        return {"success": False, "error": f"记忆 {mem_id} 不存在"}
    return {"success": True, "data": item}


@router.post("")
async def create_memory(req: MemoryCreateRequest):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.create_memory(
        content=req.content, category=req.category, title=req.title,
        importance=req.importance, expires_at=req.expires_at,
        tags=req.tags, created_by="manual"
    )
    return {"success": True, "data": item}


@router.put("/{mem_id}")
async def update_memory(mem_id: str, req: MemoryUpdateRequest):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    item = svc.update_memory(mem_id, changed_by="manual",
        content=req.content, category=req.category, title=req.title,
        importance=req.importance, tags=req.tags, is_active=req.is_active,
        expires_at=req.expires_at)
    if not item:
        return {"success": False, "error": f"记忆 {mem_id} 不存在"}
    return {"success": True, "data": item}


@router.delete("/{mem_id}")
async def forget_memory(mem_id: str):
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    return {"success": svc.forget_memory(mem_id)}
