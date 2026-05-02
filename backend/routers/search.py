"""
统一搜索 API 路由
"""
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def unified_search(
    q: str = Query(..., min_length=1),
    types: str = Query(None),
    limit: int = Query(30, le=100),
    offset: int = Query(0)
):
    """跨类统一搜索"""
    from backend.services.search_service import SearchService
    svc = SearchService()
    type_list = [t.strip() for t in types.split(",")] if types else None
    results = svc.search_unified(q, types=type_list, limit=limit)
    return {"success": True, "data": results, "count": len(results)}


@router.get("/rules")
async def search_rules(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("rules", q, limit=limit)}


@router.get("/knowledge")
async def search_knowledge(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("knowledge", q, limit=limit)}


@router.get("/experiences")
async def search_experiences(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("experiences", q, limit=limit)}


@router.get("/memories")
async def search_memories(q: str = Query(...), limit: int = Query(20)):
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("memories", q, limit=limit)}


@router.post("/index/rebuild")
async def rebuild_index():
    """重建所有搜索索引"""
    from backend.services.search_service import SearchService
    svc = SearchService()
    svc.rebuild_all_indexes()
    return {"success": True, "message": "搜索索引重建完成"}
