# -*- coding: utf-8 -*-
"""兼容层 API — MD 文件同步 + Obsidian + 自动学习"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/compat", tags=["compat"])


class ObsidianSyncRequest(BaseModel):
    vault_path: str
    direction: str = "export"  # export / import / bidirectional


@router.get("/export/memory")
async def export_memory_md():
    """导出 memories 表为 MEMORY.md"""
    from backend.services.compat_service import CompatService
    svc = CompatService()
    content = svc.export_memory_md()
    return {"success": True, "content": content, "char_count": len(content)}


@router.get("/export/user")
async def export_user_md():
    """导出 memories 表为 USER.md"""
    from backend.services.compat_service import CompatService
    svc = CompatService()
    content = svc.export_user_md()
    return {"success": True, "content": content, "char_count": len(content)}


@router.get("/export/learnings")
async def export_learnings_md():
    """导出 experiences 表为 learnings.md"""
    from backend.services.compat_service import CompatService
    svc = CompatService()
    content = svc.export_learnings_md()
    return {"success": True, "content": content, "char_count": len(content)}


@router.post("/sync/md-to-db")
async def sync_md_to_db():
    """从 MD 文件导入到 SQLite（MEMORY.md + USER.md + learnings.md）"""
    from backend.services.compat_service import CompatService
    svc = CompatService()
    results = {
        "memory_imported": svc.import_memory_md(),
        "user_imported": svc.import_user_md(),
        "learnings_imported": svc.import_learnings_md()
    }
    # 同步写入 MD 文件（确保双向一致）
    svc.save_memory_md()
    svc.save_user_md()
    svc.save_learnings_md()
    return {"success": True, "data": results}


@router.post("/sync/db-to-md")
async def sync_db_to_md():
    """从 SQLite 导出到 MD 文件"""
    from backend.services.compat_service import CompatService
    svc = CompatService()
    svc.save_memory_md()
    svc.save_user_md()
    svc.save_learnings_md()
    return {"success": True, "message": "已同步到 MD 文件"}


@router.post("/sync/obsidian")
async def sync_obsidian(req: ObsidianSyncRequest):
    """Obsidian 双向同步"""
    from backend.services.compat_service import CompatService
    svc = CompatService()
    results = {}

    if req.direction in ("export", "bidirectional"):
        result = svc.sync_to_obsidian(req.vault_path)
        if not result["success"]:
            return result
        results["export"] = result["data"]

    if req.direction in ("import", "bidirectional"):
        result = svc.sync_from_obsidian(req.vault_path)
        results["import"] = result["data"]

    return {"success": True, "data": results}


@router.post("/auto-learn")
async def trigger_auto_learn():
    """触发自动学习（从最近会话中提取知识）"""
    from backend.services.knowledge_extractor import KnowledgeExtractor
    from backend.services.hermes_service import hermes_service

    extractor = KnowledgeExtractor()
    sessions = hermes_service.list_sessions(limit=5)
    total = {"knowledge": 0, "experiences": 0, "memories": 0, "review_ids": []}

    for session in sessions:
        session_id = session.get("id", "")
        if not session_id:
            continue
        result = extractor.extract_from_session(session_id, auto_submit=True)
        total["knowledge"] += len(result["knowledge"])
        total["experiences"] += len(result["experiences"])
        total["memories"] += len(result["memories"])
        total["review_ids"].extend(result["review_ids"])

    return {"success": True, "data": total}


@router.post("/auto-learn/{session_id}")
async def trigger_auto_learn_session(session_id: str):
    """从指定会话中提取知识"""
    from backend.services.knowledge_extractor import KnowledgeExtractor

    extractor = KnowledgeExtractor()
    result = extractor.extract_from_session(session_id, auto_submit=True)
    return {"success": True, "data": result}
