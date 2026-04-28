# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 配置管理模块"""

import os
from pathlib import Path
from typing import Any, Dict, Optional

import yaml


# 默认配置
DEFAULT_CONFIG: Dict[str, Any] = {
    "hermes_home": os.path.expanduser("~/.hermes"),
    "host": "0.0.0.0",
    "port": 8000,
    "debug": True,
    "cors_origins": ["*"],
    "database_url": None,  # 将根据 hermes_home 自动推导
}

# 全局配置缓存
_config_cache: Optional[Dict[str, Any]] = None


def _load_yaml_config(config_path: Path) -> Dict[str, Any]:
    """从 YAML 文件加载配置"""
    if not config_path.exists():
        return {}
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def get_config() -> Dict[str, Any]:
    """
    获取全局配置，优先级：环境变量 > config.yaml > 默认值

    Returns:
        合并后的配置字典
    """
    global _config_cache
    if _config_cache is not None:
        return _config_cache

    # 从默认值开始
    config = DEFAULT_CONFIG.copy()

    # 从环境变量覆盖
    if env_home := os.environ.get("HERMES_HOME"):
        config["hermes_home"] = env_home
    if env_host := os.environ.get("HERMES_HOST"):
        config["host"] = env_host
    if env_port := os.environ.get("HERMES_PORT"):
        config["port"] = int(env_port)
    if env_debug := os.environ.get("HERMES_DEBUG"):
        config["debug"] = env_debug.lower() in ("true", "1", "yes")

    # 从 config.yaml 加载
    hermes_home = Path(config["hermes_home"])
    config_yaml_path = hermes_home / "config.yaml"
    yaml_config = _load_yaml_config(config_yaml_path)
    config.update(yaml_config)

    # 确保关键路径存在
    config["hermes_home"] = str(hermes_home)
    config["database_url"] = config.get(
        "database_url",
        f"sqlite:///{hermes_home / 'data' / 'sessions.db'}",
    )

    # 确保子目录路径
    config.setdefault("skills_dir", str(hermes_home / "skills"))
    config.setdefault("memories_dir", str(hermes_home / "memories"))
    config.setdefault("cron_dir", str(hermes_home / "cron"))
    config.setdefault("agents_dir", str(hermes_home / "agents"))

    _config_cache = config
    return config


def reload_config() -> Dict[str, Any]:
    """重新加载配置（清除缓存后重新读取）"""
    global _config_cache
    _config_cache = None
    return get_config()


def get_hermes_home() -> Path:
    """获取 Hermes 主目录路径"""
    return Path(get_config()["hermes_home"])


def get_skills_dir() -> Path:
    """获取技能目录路径"""
    return Path(get_config()["skills_dir"])


def get_memories_dir() -> Path:
    """获取记忆目录路径"""
    return Path(get_config()["memories_dir"])


def get_cron_dir() -> Path:
    """获取定时任务目录路径"""
    return Path(get_config()["cron_dir"])


def get_agents_dir() -> Path:
    """获取子 Agent 目录路径"""
    return Path(get_config()["agents_dir"])
