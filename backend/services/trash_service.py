# -*- coding: utf-8 -*-
"""Hermes Agent - 回收站服务"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

# 回收站数据文件
_TRASH_DIR: Optional[Path] = None


def _get_trash_dir() -> Path:
    global _TRASH_DIR
    if _TRASH_DIR is None:
        home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
        _TRASH_DIR = Path(home) / "data" / "trash"
        _TRASH_DIR.mkdir(parents=True, exist_ok=True)
    return _TRASH_DIR


def _load_trash() -> List[Dict]:
    """加载回收站数据"""
    trash_file = _get_trash_dir() / "trash.json"
    if trash_file.exists():
        try:
            return json.loads(trash_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_trash(items: List[Dict]):
    """保存回收站数据"""
    trash_file = _get_trash_dir() / "trash.json"
    trash_file.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def move_to_trash(
    item_type: str,
    item_id: str,
    item_name: str,
    item_data: Any,
    metadata: Optional[Dict] = None,
) -> Dict[str, Any]:
    """将项目移到回收站

    Args:
        item_type: 类型 (session/skill/memory/plugin/config)
        item_id: 项目 ID
        item_name: 项目名称
        item_data: 项目原始数据
        metadata: 额外元数据

    Returns:
        {"success": True, "message": "..."}
    """
    items = _load_trash()

    item = {
        "id": f"trash-{int(time.time() * 1000)}",
        "type": item_type,
        "item_id": item_id,
        "item_name": item_name,
        "data": item_data,
        "metadata": metadata or {},
        "deleted_at": datetime.now().isoformat(),
    }

    items.insert(0, item)

    # 最多保留 100 条
    if len(items) > 100:
        items = items[:100]

    _save_trash(items)
    return {"success": True, "message": f"已移到回收站: {item_name}"}


def list_trash(item_type: str = "") -> List[Dict]:
    """列出回收站项目

    Args:
        item_type: 可选，按类型筛选
    """
    items = _load_trash()
    if item_type:
        items = [i for i in items if i.get("type") == item_type]
    return items


def restore_item(trash_id: str) -> Dict[str, Any]:
    """从回收站恢复项目

    Args:
        trash_id: 回收站项目 ID
    """
    items = _load_trash()
    target = next((i for i in items if i.get("id") == trash_id), None)

    if not target:
        return {"success": False, "message": f"回收站中不存在: {trash_id}"}

    item_type = target.get("type")
    item_id = target.get("item_id")
    item_data = target.get("data")

    # 根据类型恢复
    try:
        if item_type == "skill":
            _restore_skill(item_id, item_data)
        elif item_type == "session":
            _restore_session(item_id, item_data)
        elif item_type == "memory":
            _restore_memory(item_id, item_data)
        elif item_type == "plugin":
            _restore_plugin(item_id, item_data)
        elif item_type == "config":
            _restore_config(item_id, item_data)
        else:
            return {"success": False, "message": f"未知类型: {item_type}"}
    except Exception as e:
        return {"success": False, "message": f"恢复失败: {str(e)}"}

    # 从回收站移除
    items = [i for i in items if i.get("id") != trash_id]
    _save_trash(items)

    return {"success": True, "message": f"已恢复: {target.get('item_name', item_id)}"}


def permanent_delete(trash_id: str) -> Dict[str, Any]:
    """永久删除回收站项目"""
    items = _load_trash()
    target = next((i for i in items if i.get("id") == trash_id), None)

    if not target:
        return {"success": False, "message": f"回收站中不存在: {trash_id}"}

    items = [i for i in items if i.get("id") != trash_id]
    _save_trash(items)

    return {"success": True, "message": f"已永久删除: {target.get('item_name', trash_id)}"}


def empty_trash() -> Dict[str, Any]:
    """清空回收站"""
    _save_trash([])
    return {"success": True, "message": "回收站已清空"}


def _restore_skill(name: str, data: Any):
    """恢复技能"""
    from backend.services.hermes_service import HermesService
    service = HermesService()
    content = data if isinstance(data, str) else data.get("content", "")
    service.update_skill(name, content=content)


def _restore_session(session_id: str, data: Any):
    """恢复会话"""
    from backend.services.hermes_service import HermesService
    service = HermesService()
    # 重新创建会话
    service.create_session(
        title=data.get("title", "恢复的会话"),
        model=data.get("model", ""),
        source=data.get("source", "restored"),
    )


def _restore_memory(key: str, data: Any):
    """恢复记忆"""
    from backend.services.hermes_service import HermesService
    service = HermesService()
    content = data if isinstance(data, str) else data.get("content", "")
    service.write_memory(key, content)


def _restore_plugin(name: str, data: Any):
    """恢复插件"""
    from backend.services.plugin_service import plugin_service
    # 插件恢复需要重新安装
    pass


def _restore_config(key: str, data: Any):
    """恢复配置"""
    import yaml
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    config_path = Path(home) / "config.yaml"
    if config_path.exists():
        existing = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    else:
        existing = {}
    if isinstance(data, dict):
        existing.update(data)
        config_path.write_text(yaml.dump(existing, allow_unicode=True, default_flow_style=False), encoding="utf-8")
