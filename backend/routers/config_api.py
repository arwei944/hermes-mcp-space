# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 配置管理 API（含版本管理）"""

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter

from backend.config import get_config, reload_config

router = APIRouter(prefix="/api/config", tags=["config"])

_MAX_VERSIONS = 50


def _get_versions_path() -> Path:
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    data_dir = Path(home) / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "config_versions.json"


def _load_versions() -> List[Dict[str, Any]]:
    path = _get_versions_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _save_versions(versions: List[Dict[str, Any]]) -> None:
    path = _get_versions_path()
    try:
        path.write_text(json.dumps(versions[:_MAX_VERSIONS], ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


@router.get("", summary="获取当前配置")
async def get_current_config() -> Dict[str, Any]:
    config = get_config()
    sensitive_keys = {"api_key", "token", "password", "secret", "database_url"}
    safe_config = {}
    for key, value in config.items():
        if any(s in key.lower() for s in sensitive_keys):
            if isinstance(value, str) and len(value) > 8:
                safe_config[key] = value[:4] + "****" + value[-4:]
            elif isinstance(value, str):
                safe_config[key] = "****"
            else:
                safe_config[key] = value
        else:
            safe_config[key] = value
    return safe_config


@router.put("", summary="更新配置")
async def update_config(body: Dict[str, Any]) -> Dict[str, Any]:
    import yaml
    from backend.config import get_hermes_home

    # 支持前端传 { config: {...}, summary: "..." } 格式
    if "config" in body and isinstance(body["config"], dict):
        config_data = body["config"]
        summary = body.get("summary", "")
    else:
        config_data = body
        summary = ""

    hermes_home = get_hermes_home()
    config_yaml_path = hermes_home / "config.yaml"

    # 读取现有配置
    existing_config = {}
    if config_yaml_path.exists():
        try:
            existing_config = yaml.safe_load(config_yaml_path.read_text(encoding="utf-8")) or {}
        except Exception:
            pass

    # 保存版本快照
    if config_data:
        versions = _load_versions()
        version_num = len(versions) + 1
        versions.insert(0, {
            "version": version_num,
            "timestamp": datetime.now().isoformat(),
            "config": dict(existing_config),
            "summary": summary or f"手动保存 (v{version_num})",
        })
        _save_versions(versions)

    # 合并更新
    existing_config.update(config_data)
    config_yaml_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        config_yaml_path.write_text(
            yaml.dump(existing_config, allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
    except Exception as e:
        return {"success": False, "message": f"写入配置文件失败: {str(e)}"}

    reload_config()
    return {"success": True, "message": "配置已更新", "version": version_num}


@router.post("/reset", summary="重置配置为默认值")
async def reset_config() -> Dict[str, Any]:
    from backend.config import get_hermes_home
    import yaml

    hermes_home = get_hermes_home()
    config_yaml_path = hermes_home / "config.yaml"
    backup_path = hermes_home / "config.yaml.bak"

    if config_yaml_path.exists():
        shutil.copy2(str(config_yaml_path), str(backup_path))

    default_config = {
        "model": "gpt-4o",
        "temperature": 0.7,
        "log_level": "info",
        "mcp_enabled": True,
        "mcp_port": 8765,
    }

    config_yaml_path.parent.mkdir(parents=True, exist_ok=True)
    config_yaml_path.write_text(
        yaml.dump(default_config, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )

    reload_config()
    return {"success": True, "message": "配置已重置为默认值"}


@router.get("/versions", summary="获取配置版本历史")
async def get_config_versions() -> Dict[str, Any]:
    """获取所有配置版本（不包含完整配置内容，只返回版本号和时间）"""
    versions = _load_versions()
    # 返回精简版本（不包含完整 config 数据，减少传输量）
    return {
        "versions": [
            {
                "version": v.get("version"),
                "timestamp": v.get("timestamp"),
                "summary": v.get("summary", ""),
            }
            for v in versions
        ]
    }


@router.post("/rollback/{index}", summary="回滚到指定版本")
async def rollback_config(index: int) -> Dict[str, Any]:
    """回滚到指定版本的配置"""
    import yaml
    from backend.config import get_hermes_home

    versions = _load_versions()
    if index < 0 or index >= len(versions):
        return {"success": False, "message": "无效的版本索引"}

    target = versions[index]
    config_data = target.get("config", {})
    if not config_data:
        return {"success": False, "message": "该版本没有配置数据"}

    hermes_home = get_hermes_home()
    config_yaml_path = hermes_home / "config.yaml"
    config_yaml_path.parent.mkdir(parents=True, exist_ok=True)

    # 保存当前版本
    current_versions = _load_versions()
    current_versions.insert(0, {
        "version": len(current_versions) + 1,
        "timestamp": datetime.now().isoformat(),
        "config": dict(get_config()),
        "summary": f"回滚前自动保存 (从 v{target.get('version', '?')} 回滚)",
    })
    _save_versions(current_versions)

    # 写入目标版本配置
    try:
        config_yaml_path.write_text(
            yaml.dump(config_data, allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
    except Exception as e:
        return {"success": False, "message": f"写入失败: {str(e)}"}

    reload_config()
    return {"success": True, "message": f"已回滚到版本 v{target.get('version', '?')}"}
