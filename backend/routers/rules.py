"""
规则 CRUD API 路由
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/rules", tags=["rules"])


class RuleCreateRequest(BaseModel):
    title: str
    content: str = ""
    category: str = "general"
    priority: int = 5
    scope: str = "global"
    scope_value: str = ""
    tags: List[str] = []


class RuleUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[int] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


# 路由定义
@router.get("")
async def list_rules(
    category: str = Query(None),
    is_active: bool = Query(None),
    tags: str = Query(None),
    priority_min: int = Query(0),
    limit: int = Query(50, le=200),
    offset: int = Query(0)
):
    """列出规则"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    return {"success": True, "data": svc.list_rules(
        category=category, is_active=is_active, tags=tag_list,
        priority_min=priority_min if priority_min > 0 else None,
        limit=limit, offset=offset
    )}


@router.get("/search")
async def search_rules(q: str = Query(...), limit: int = Query(20)):
    """搜索规则"""
    from backend.services.search_service import SearchService
    svc = SearchService()
    return {"success": True, "data": svc.search_single_type("rules", q, limit=limit)}


@router.get("/stats")
async def rule_stats():
    """规则统计"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    from backend.db import get_knowledge_db
    conn = get_knowledge_db()
    categories = svc._query(
        "SELECT category, COUNT(*) as count FROM rules WHERE is_active=1 GROUP BY category"
    )
    return {"success": True, "data": {"total": len(svc.list_rules(is_active=True)), "by_category": categories}}


@router.get("/{rule_id}")
async def get_rule(rule_id: str):
    """获取规则详情"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    rule = svc.get_rule(rule_id)
    if not rule:
        return {"success": False, "error": f"规则 {rule_id} 不存在"}
    return {"success": True, "data": rule}


@router.post("")
async def create_rule(req: RuleCreateRequest):
    """创建规则（直接写入，不经过审核 — Web 端操作视为人工操作）"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    rule = svc.create_rule(
        title=req.title, content=req.content, category=req.category,
        priority=req.priority, scope=req.scope, scope_value=req.scope_value,
        tags=req.tags, created_by="manual"
    )
    return {"success": True, "data": rule}


@router.put("/{rule_id}")
async def update_rule(rule_id: str, req: RuleUpdateRequest):
    """更新规则"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    rule = svc.update_rule(rule_id, changed_by="manual",
        title=req.title, content=req.content, category=req.category,
        priority=req.priority, tags=req.tags, is_active=req.is_active)
    if not rule:
        return {"success": False, "error": f"规则 {rule_id} 不存在"}
    return {"success": True, "data": rule}


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str):
    """删除规则（软删除）"""
    from backend.services.knowledge_service import KnowledgeService
    svc = KnowledgeService()
    success = svc.delete_rule(rule_id)
    return {"success": success}
