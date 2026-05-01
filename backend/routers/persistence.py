# -*- coding: utf-8 -*-
"""Hermes Agent - 持久化管理 API 路由

提供持久化管理的 REST API 端点，包括：
- GET  /api/persistence/status     — 获取持久化状态
- POST /api/persistence/backup     — 手动备份
- POST /api/persistence/restore    — 手动恢复
- POST /api/persistence/switch     — 切换后端
- GET  /api/persistence/backends   — 列出可用后端
- POST /api/persistence/config     — 更新配置
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger("hermes.persistence.api")

router = APIRouter(prefix="/api/persistence", tags=["persistence"])


class SwitchRequest(BaseModel):
    """切换后端请求"""
    backend: str  # "git" | "hf_buckets" | "none"


class ConfigRequest(BaseModel):
    """更新配置请求"""
    backend: Optional[str] = None
    auto_backup_interval: Optional[int] = None
    backup_on_shutdown: Optional[bool] = None
    git: Optional[Dict[str, str]] = None
    hf_buckets: Optional[Dict[str, str]] = None


class BackupRequest(BaseModel):
    """备份请求"""
    items: Optional[list] = None  # 指定要备份的文件，None=全部


class RestoreRequest(BaseModel):
    """恢复请求"""
    items: Optional[list] = None  # 指定要恢复的文件，None=全部


@router.get("/status", summary="获取持久化状态")
async def get_status():
    """获取持久化管理器的完整状态"""
    from backend.services.persistence_manager import persistence_manager
    return persistence_manager.status()


@router.get("/backends", summary="列出可用后端")
async def list_backends():
    """列出所有可用的持久化后端"""
    from backend.services.backends import BACKEND_REGISTRY

    backends = []
    for name, cls in BACKEND_REGISTRY.items():
        backends.append({
            "name": name,
            "description": cls.description,
        })

    return {
        "backends": backends,
        "current": persistence_manager_status(),
    }


def persistence_manager_status() -> Dict[str, Any]:
    """获取当前后端状态（辅助函数）"""
    from backend.services.persistence_manager import persistence_manager
    return {
        "backend": persistence_manager._backend_name,
        "configured": persistence_manager._backend.configured if persistence_manager._backend else False,
    }


@router.post("/backup", summary="手动备份")
async def manual_backup(request: BackupRequest = None):
    """手动触发数据备份"""
    from backend.services.persistence_manager import persistence_manager

    items = request.items if request else None
    result = persistence_manager.backup(items)
    return result


@router.post("/restore", summary="手动恢复")
async def manual_restore(request: RestoreRequest = None):
    """手动触发数据恢复"""
    from backend.services.persistence_manager import persistence_manager

    items = request.items if request else None
    result = persistence_manager.restore(items)
    return result


@router.post("/switch", summary="切换持久化后端")
async def switch_backend(request: SwitchRequest):
    """切换到指定的持久化后端"""
    from backend.services.persistence_manager import persistence_manager

    result = persistence_manager.switch_backend(request.backend)
    return result


@router.post("/config", summary="更新持久化配置")
async def update_config(request: ConfigRequest):
    """更新持久化配置"""
    from backend.services.persistence_manager import persistence_manager

    config = persistence_manager._config

    if request.backend is not None:
        config["backend"] = request.backend
    if request.auto_backup_interval is not None:
        config["auto_backup_interval"] = request.auto_backup_interval
    if request.backup_on_shutdown is not None:
        config["backup_on_shutdown"] = request.backup_on_shutdown
    if request.git is not None:
        config.setdefault("git", {}).update(request.git)
    if request.hf_buckets is not None:
        config.setdefault("hf_buckets", {}).update(request.hf_buckets)

    persistence_manager._save_config()

    # 如果切换了后端，重新初始化
    if request.backend is not None:
        try:
            persistence_manager.switch_backend(request.backend)
        except Exception as e:
            return {"success": False, "error": str(e)}

    return {"success": True, "config": config}


@router.post("/pre-update", summary="更新前备份")
async def pre_update_backup():
    """在版本更新前触发备份（热更新流程）"""
    from backend.services.persistence_manager import persistence_manager
    result = persistence_manager.pre_update_backup()
    return result


# ==================== BackupService 数据恢复端点 ====================

@router.post("/backup-snapshot", summary="创建数据快照备份")
async def create_backup_snapshot(body: dict = None):
    """基于 BackupService 创建数据快照备份"""
    from backend.services.backup_service import backup_service
    items = (body or {}).get("items")
    result = backup_service.create_backup(items)
    return result


@router.get("/backup-snapshots", summary="列出所有快照备份")
async def list_backup_snapshots():
    """列出所有快照备份"""
    from backend.services.backup_service import backup_service
    return {"backups": backup_service.list_backups()}


@router.post("/backup-snapshots/restore", summary="从快照恢复数据")
async def restore_from_snapshot(body: dict):
    """从指定的快照备份恢复数据"""
    from backend.services.backup_service import backup_service
    backup_name = body.get("backup_name", "")
    items = body.get("items")
    result = backup_service.restore_backup(backup_name, items)
    return result


@router.post("/backup-snapshots/cleanup", summary="清理旧快照备份")
async def cleanup_backup_snapshots(body: dict = None):
    """清理旧快照备份，保留最新的 N 个"""
    from backend.services.backup_service import backup_service
    keep = (body or {}).get("keep_count", 10)
    removed = backup_service.cleanup_old_backups(keep)
    return {"success": True, "removed": removed}
