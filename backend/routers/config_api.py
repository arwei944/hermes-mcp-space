# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 配置管理 API

提供配置的读取和更新接口。
"""

from typing import Any, Dict

from fastapi import APIRouter

from backend.config import get_config, reload_config

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", summary="获取当前配置")
async def get_current_config() -> Dict[str, Any]:
    """
    获取 Hermes Agent 的当前配置

    返回配置信息（敏感信息如 API Key 会被脱敏处理）
    """
    config = get_config()

    # 脱敏处理：隐藏敏感字段
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
    """
    更新 Hermes Agent 的配置

    支持部分更新，只传需要修改的字段。
    配置会写入 ~/.hermes/config.yaml。
    """
    import yaml
    from pathlib import Path
    from backend.config import get_hermes_home

    hermes_home = get_hermes_home()
    config_yaml_path = hermes_home / "config.yaml"

    # 读取现有配置
    existing_config = {}
    if config_yaml_path.exists():
        try:
            existing_config = yaml.safe_load(
                config_yaml_path.read_text(encoding="utf-8")
            ) or {}
        except Exception:
            pass

    # 合并更新
    existing_config.update(body)

    # 确保目录存在
    config_yaml_path.parent.mkdir(parents=True, exist_ok=True)

    # 写入配置文件
    try:
        config_yaml_path.write_text(
            yaml.dump(existing_config, allow_unicode=True, default_flow_style=False),
            encoding="utf-8",
        )
    except Exception as e:
        return {"success": False, "message": f"写入配置文件失败: {str(e)}"}

    # 重新加载配置
    reload_config()

    return {
        "success": True,
        "message": "配置已更新",
        "updated_keys": list(body.keys()),
    }


@router.post("/reset", summary="重置配置为默认值")
async def reset_config() -> Dict[str, Any]:
    """重置所有配置为默认值"""
    from backend.config import get_hermes_home
    from pathlib import Path
    import shutil

    hermes_home = get_hermes_home()
    config_yaml_path = hermes_home / "config.yaml"
    backup_path = hermes_home / "config.yaml.bak"

    # 备份当前配置
    if config_yaml_path.exists():
        shutil.copy2(str(config_yaml_path), str(backup_path))

    # 写入默认配置
    default_config = {
        "model": "gpt-4o",
        "temperature": 0.7,
        "log_level": "info",
        "mcp_enabled": True,
        "mcp_port": 8765,
    }

    import yaml
    config_yaml_path.parent.mkdir(parents=True, exist_ok=True)
    config_yaml_path.write_text(
        yaml.dump(default_config, allow_unicode=True, default_flow_style=False),
        encoding="utf-8",
    )

    reload_config()

    return {"success": True, "message": "配置已重置为默认值"}
