# -*- coding: utf-8 -*-
"""Hermes Agent - 统一持久化管理器

提供统一的数据持久化接口，支持多种存储后端（Git、HF Buckets 等），
可自由切换。核心功能：
- backup(): 备份所有数据到当前后端
- restore(): 从当前后端恢复数据
- switch_backend(): 切换存储后端
- status(): 查看备份状态
- auto_backup(): 定时自动备份
- pre_update_backup(): 更新前备份（热更新流程）

使用方式：
    from backend.services.persistence_manager import persistence_manager

    # 启动时恢复
    persistence_manager.restore_on_startup()

    # 手动备份
    result = persistence_manager.backup()

    # 切换后端
    persistence_manager.switch_backend("hf_buckets")
"""

import json
import logging
import os
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes.persistence")


class PersistenceManager:
    """统一持久化管理器

    管理所有数据持久化操作，支持多后端切换。
    """

    # 需要持久化的文件/目录列表
    PERSIST_ITEMS = [
        "data/sessions.json",
        "data/logs.json",
        "data/cron_jobs.json",
        "mcp_servers.json",
        "memories/MEMORY.md",
        "memories/USER.md",
        "learnings.md",
        "logs/tool_traces.jsonl",
    ]

    def __init__(self):
        self._backend = None
        self._backend_name = ""
        self._config: Dict[str, Any] = {}
        self._hermes_home: Optional[Path] = None
        self._auto_backup_thread: Optional[threading.Thread] = None
        self._auto_backup_stop = threading.Event()
        self._last_backup_time: Optional[datetime] = None
        self._last_backup_result: Optional[Dict[str, Any]] = None
        self._initialized = False

    @property
    def hermes_home(self) -> Path:
        """获取 Hermes 主目录"""
        if self._hermes_home is None:
            home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
            self._hermes_home = Path(home)
        return self._hermes_home

    def initialize(self, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """初始化持久化管理器

        Args:
            config: 持久化配置字典，格式：
                {
                    "backend": "git",  # "git" | "hf_buckets" | "none"
                    "auto_backup_interval": 300,  # 秒，0=禁用
                    "backup_on_shutdown": True,
                    "git": {"repo_url": "...", "branch": "main"},
                    "hf_buckets": {"repo_id": "...", "token": "..."}
                }

        Returns:
            初始化结果
        """
        if self._initialized:
            return {"success": True, "message": "已初始化"}

        # 加载配置
        self._config = config or self._load_config()
        backend_name = self._config.get("backend", "none")

        if backend_name != "none":
            try:
                self._switch_backend(backend_name)
                logger.info(f"Persistence backend initialized: {backend_name}")
            except Exception as e:
                logger.error(f"Failed to initialize backend '{backend_name}': {e}")
                return {"success": False, "error": str(e)}

        # 启动自动备份
        interval = self._config.get("auto_backup_interval", 0)
        if interval and interval > 0:
            self._start_auto_backup(interval)

        self._initialized = True
        return {
            "success": True,
            "backend": backend_name,
            "auto_backup_interval": interval,
        }

    def _load_config(self) -> Dict[str, Any]:
        """从配置文件加载持久化配置"""
        # 1. 尝试从 hermes_home/config.yaml 加载
        config_yaml = self.hermes_home / "config.yaml"
        if config_yaml.exists():
            try:
                import yaml
                with open(config_yaml, "r", encoding="utf-8") as f:
                    full_config = yaml.safe_load(f) or {}
                persistence_config = full_config.get("persistence", {})
                if persistence_config:
                    return persistence_config
            except Exception:
                pass

        # 2. 尝试从 persistence.json 加载
        persist_config = self.hermes_home / "persistence.json"
        if persist_config.exists():
            try:
                return json.loads(persist_config.read_text(encoding="utf-8"))
            except Exception:
                pass

        # 3. 从环境变量推断
        git_url = os.environ.get("PERSISTENCE_GIT_REPO_URL", "")
        hf_repo = os.environ.get("PERSISTENCE_HF_REPO_ID", "")
        if git_url:
            logger.info(f"Auto-detected persistence backend 'git' from PERSISTENCE_GIT_REPO_URL")
            return {
                "backend": "git",
                "auto_backup_interval": 600,
                "backup_on_shutdown": True,
                "git": {
                    "repo_url": git_url,
                    "branch": "main",
                },
            }
        if hf_repo:
            logger.info(f"Auto-detected persistence backend 'hf_buckets' from PERSISTENCE_HF_REPO_ID")
            return {
                "backend": "hf_buckets",
                "auto_backup_interval": 600,
                "backup_on_shutdown": True,
                "hf_buckets": {
                    "repo_id": hf_repo,
                },
            }

        # 4. 默认配置
        return {
            "backend": "none",
            "auto_backup_interval": 0,
            "backup_on_shutdown": True,
        }

    def _save_config(self) -> bool:
        """保存持久化配置到文件"""
        config_path = self.hermes_home / "persistence.json"
        try:
            config_path.write_text(
                json.dumps(self._config, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save persistence config: {e}")
            return False

    def _switch_backend(self, backend_name: str) -> None:
        """切换存储后端"""
        from backend.services.backends import BACKEND_REGISTRY

        if backend_name not in BACKEND_REGISTRY:
            raise ValueError(f"Unknown backend: {backend_name}. Available: {list(BACKEND_REGISTRY.keys())}")

        backend_class = BACKEND_REGISTRY[backend_name]
        backend_config = self._config.get(backend_name, {})
        self._backend = backend_class(backend_config)
        self._backend_name = backend_name

        logger.info(f"Switched persistence backend to: {backend_name}")

    def switch_backend(self, backend_name: str) -> Dict[str, Any]:
        """切换存储后端（公开 API）

        Args:
            backend_name: 后端名称 ("git" | "hf_buckets" | "none")

        Returns:
            切换结果
        """
        try:
            if backend_name == "none":
                self._backend = None
                self._backend_name = "none"
                self._config["backend"] = "none"
                self._save_config()
                return {"success": True, "message": "已禁用持久化"}
            else:
                self._switch_backend(backend_name)
                self._config["backend"] = backend_name
                self._save_config()
                return {
                    "success": True,
                    "message": f"已切换到 {backend_name} 后端",
                    "backend": backend_name,
                    "configured": self._backend.configured if self._backend else False,
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def backup(self, items: Optional[List[str]] = None) -> Dict[str, Any]:
        """手动备份数据

        Args:
            items: 要备份的文件列表（默认全部）

        Returns:
            备份结果
        """
        if not self._backend:
            return {"success": False, "error": "没有激活的持久化后端"}

        if not self._backend.configured:
            return {
                "success": False,
                "error": f"{self._backend_name} 后端未正确配置",
                "config_info": self._backend.config_info if self._backend else {},
            }

        logger.info(f"Starting backup to {self._backend_name}...")
        result = self._backend.backup(self.hermes_home, items)

        self._last_backup_time = datetime.now()
        self._last_backup_result = result

        if result.get("success"):
            logger.info(f"Backup completed: {result.get('message', '')}")
        else:
            logger.error(f"Backup failed: {result.get('error', 'unknown')}")

        return result

    def restore(self, items: Optional[List[str]] = None) -> Dict[str, Any]:
        """手动恢复数据

        Args:
            items: 要恢复的文件列表（默认全部）

        Returns:
            恢复结果
        """
        if not self._backend:
            return {"success": False, "error": "没有激活的持久化后端"}

        if not self._backend.configured:
            return {
                "success": False,
                "error": f"{self._backend_name} 后端未正确配置",
                "config_info": self._backend.config_info if self._backend else {},
            }

        logger.info(f"Starting restore from {self._backend_name}...")
        result = self._backend.restore(self.hermes_home, items)

        if result.get("success"):
            logger.info(f"Restore completed: {result.get('message', '')}")
        else:
            logger.error(f"Restore failed: {result.get('error', 'unknown')}")

        return result

    def restore_on_startup(self) -> Dict[str, Any]:
        """启动时自动恢复数据

        在 app.py 启动时调用，从持久化后端恢复数据。
        如果没有配置后端或后端未就绪，静默跳过。
        """
        if not self._backend or not self._backend.configured:
            logger.info("No persistence backend configured, skipping restore")
            return {"success": True, "message": "未配置持久化后端，跳过恢复"}

        # 检查本地是否已有数据（避免覆盖已有数据）
        sessions_path = self.hermes_home / "data" / "sessions.json"
        if sessions_path.exists():
            try:
                data = json.loads(sessions_path.read_text(encoding="utf-8"))
                sessions = data.get("sessions", [])
                messages = data.get("messages", {})
                total_msgs = sum(len(msgs) for msgs in messages.values())
                if sessions or total_msgs > 0:
                    logger.info(
                        f"Local data exists ({len(sessions)} sessions, {total_msgs} messages), "
                        f"skipping restore to preserve current data"
                    )
                    return {
                        "success": True,
                        "message": "本地已有数据，跳过恢复以保留当前数据",
                        "local_sessions": len(sessions),
                        "local_messages": total_msgs,
                    }
            except Exception:
                pass

        # 执行恢复
        result = self.restore()
        return result

    def pre_update_backup(self) -> Dict[str, Any]:
        """更新前备份（热更新流程的一部分）

        在版本更新前调用，确保数据安全。
        """
        logger.info("Pre-update backup triggered")
        result = self.backup()

        if result.get("success"):
            # 记录备份时间戳
            timestamp_file = self.hermes_home / ".last_backup_timestamp"
            try:
                timestamp_file.write_text(datetime.now().isoformat())
            except Exception:
                pass

        return result

    def status(self) -> Dict[str, Any]:
        """获取持久化状态"""
        result = {
            "initialized": self._initialized,
            "backend": self._backend_name,
            "hermes_home": str(self.hermes_home),
            "persist_items": self.PERSIST_ITEMS,
            "last_backup_time": self._last_backup_time.isoformat() if self._last_backup_time else None,
            "last_backup_result": {
                "success": self._last_backup_result.get("success") if self._last_backup_result else None,
                "message": self._last_backup_result.get("message", "") if self._last_backup_result else None,
            },
            "config": self._config,
        }

        # 获取后端状态
        if self._backend:
            try:
                result["backend_status"] = self._backend.get_status(self.hermes_home)
            except Exception as e:
                result["backend_status"] = {"error": str(e)}

        # 检查本地数据状态
        result["local_data"] = self._check_local_data()

        return result

    def _check_local_data(self) -> Dict[str, Any]:
        """检查本地数据文件状态"""
        data = {}
        for item in self.PERSIST_ITEMS:
            path = self.hermes_home / item
            if path.exists():
                stat = path.stat()
                data[item] = {
                    "exists": True,
                    "size_bytes": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                }
            else:
                data[item] = {"exists": False}
        return data

    def _start_auto_backup(self, interval_seconds: int) -> None:
        """启动自动备份线程"""
        if self._auto_backup_thread and self._auto_backup_thread.is_alive():
            return

        self._auto_backup_stop.clear()

        def _backup_loop():
            logger.info(f"Auto backup started (interval: {interval_seconds}s)")
            while not self._auto_backup_stop.wait(interval_seconds):
                try:
                    self.backup()
                except Exception as e:
                    logger.error(f"Auto backup failed: {e}")

        self._auto_backup_thread = threading.Thread(
            target=_backup_loop,
            daemon=True,
            name="persistence-auto-backup",
        )
        self._auto_backup_thread.start()

    def stop_auto_backup(self) -> None:
        """停止自动备份"""
        self._auto_backup_stop.set()
        if self._auto_backup_thread:
            self._auto_backup_thread.join(timeout=5)
            logger.info("Auto backup stopped")

    def shutdown(self) -> None:
        """关闭持久化管理器"""
        # 停止自动备份
        self.stop_auto_backup()

        # 关闭前备份
        if self._config.get("backup_on_shutdown", True) and self._backend:
            try:
                logger.info("Shutdown backup...")
                self.backup()
            except Exception as e:
                logger.error(f"Shutdown backup failed: {e}")

        self._initialized = False


# 全局单例
persistence_manager = PersistenceManager()
