# -*- coding: utf-8 -*-
"""Hermes Agent - 统一持久化管理器"""

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
    PERSIST_ITEMS = [
        "data/knowledge.db", "data/sessions.db",
        "data/sessions.json", "data/logs.json", "data/cron_jobs.json",
        "mcp_servers.json", "memories/MEMORY.md", "memories/USER.md",
        "learnings.md", "logs/tool_traces.jsonl",
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
        if self._hermes_home is None:
            home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
            self._hermes_home = Path(home)
        return self._hermes_home

    def initialize(self, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if self._initialized:
            return {"success": True, "message": "已初始化"}
        self._config = config or self._load_config()
        backend_name = self._config.get("backend", "none")
        if backend_name != "none":
            try:
                self._switch_backend(backend_name)
                logger.info(f"Persistence backend initialized: {backend_name}")
            except Exception as e:
                logger.error(f"Failed to initialize backend '{backend_name}': {e}")
                return {"success": False, "error": str(e)}
        interval = self._config.get("auto_backup_interval", 0)
        if interval and interval > 0:
            self._start_auto_backup(interval)
        self._initialized = True
        return {"success": True, "backend": backend_name, "auto_backup_interval": interval}

    def _load_config(self) -> Dict[str, Any]:
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
        persist_config = self.hermes_home / "persistence.json"
        if persist_config.exists():
            try:
                return json.loads(persist_config.read_text(encoding="utf-8"))
            except Exception:
                pass
        git_url = os.environ.get("PERSISTENCE_GIT_REPO_URL", "")
        hf_repo = os.environ.get("PERSISTENCE_HF_REPO_ID", "")
        if git_url:
            return {"backend": "git", "auto_backup_interval": 600, "backup_on_shutdown": True, "git": {"repo_url": git_url, "branch": "main"}}
        if hf_repo:
            return {"backend": "hf_buckets", "auto_backup_interval": 600, "backup_on_shutdown": True, "hf_buckets": {"repo_id": hf_repo}}
        logger.warning("No persistence backend configured. Set PERSISTENCE_HF_REPO_ID and HF_TOKEN to enable.")
        return {"backend": "none", "auto_backup_interval": 0, "backup_on_shutdown": True}

    def _save_config(self) -> bool:
        try:
            (self.hermes_home / "persistence.json").write_text(json.dumps(self._config, ensure_ascii=False, indent=2), encoding="utf-8")
            return True
        except Exception as e:
            logger.error(f"Failed to save persistence config: {e}")
            return False

    def _switch_backend(self, backend_name: str) -> None:
        from backend.services.backends import BACKEND_REGISTRY
        if backend_name not in BACKEND_REGISTRY:
            raise ValueError(f"Unknown backend: {backend_name}")
        backend_class = BACKEND_REGISTRY[backend_name]
        backend_config = self._config.get(backend_name, {})
        self._backend = backend_class(backend_config)
        self._backend_name = backend_name

    def switch_backend(self, backend_name: str) -> Dict[str, Any]:
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
                return {"success": True, "message": f"已切换到 {backend_name} 后端", "backend": backend_name}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def backup(self, items: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self._backend:
            return {"success": False, "error": "没有激活的持久化后端"}
        if not self._backend.configured:
            return {"success": False, "error": f"{self._backend_name} 后端未正确配置"}
        logger.info(f"Starting backup to {self._backend_name}...")
        result = self._backend.backup(self.hermes_home, items)
        self._last_backup_time = datetime.now()
        self._last_backup_result = result
        return result

    def restore(self, items: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self._backend or not self._backend.configured:
            return {"success": False, "error": "没有激活的持久化后端"}
        logger.info(f"Starting restore from {self._backend_name}...")
        return self._backend.restore(self.hermes_home, items)

    def restore_on_startup(self) -> Dict[str, Any]:
        if not self._backend or not self._backend.configured:
            logger.info("No persistence backend configured, skipping restore")
            return {"success": True, "message": "未配置持久化后端，跳过恢复"}
        has_local_data = False
        for db_name in ("data/knowledge.db", "data/sessions.db"):
            db_path = self.hermes_home / db_name
            if db_path.exists() and db_path.stat().st_size > 0:
                has_local_data = True
                break
        if not has_local_data:
            sessions_path = self.hermes_home / "data" / "sessions.json"
            if sessions_path.exists():
                try:
                    data = json.loads(sessions_path.read_text(encoding="utf-8"))
                    if data.get("sessions") or sum(len(m) for m in data.get("messages", {}).values()) > 0:
                        has_local_data = True
                except Exception:
                    pass
        if has_local_data:
            logger.info("Local data exists, skipping restore")
            return {"success": True, "message": "本地已有数据，跳过恢复"}
        result = self.restore()
        if result.get("success"):
            for db_name in ("data/knowledge.db", "data/sessions.db"):
                db_path = self.hermes_home / db_name
                if db_path.exists():
                    try:
                        import sqlite3
                        conn = sqlite3.connect(str(db_path), timeout=5)
                        integrity = conn.execute("PRAGMA integrity_check").fetchone()
                        conn.close()
                        if integrity and integrity[0] == "ok":
                            logger.info(f"Database integrity check passed: {db_name}")
                    except Exception as e:
                        logger.error(f"Database integrity check error for {db_name}: {e}")
        return result

    def pre_update_backup(self) -> Dict[str, Any]:
        logger.info("Pre-update backup triggered")
        return self.backup()

    def status(self) -> Dict[str, Any]:
        result = {"initialized": self._initialized, "backend": self._backend_name, "hermes_home": str(self.hermes_home),
                 "persist_items": self.PERSIST_ITEMS,
                 "last_backup_time": self._last_backup_time.isoformat() if self._last_backup_time else None}
        if self._backend:
            try:
                result["backend_status"] = self._backend.get_status(self.hermes_home)
            except Exception as e:
                result["backend_status"] = {"error": str(e)}
        result["local_data"] = self._check_local_data()
        return result

    def _check_local_data(self) -> Dict[str, Any]:
        data = {}
        for item in self.PERSIST_ITEMS:
            path = self.hermes_home / item
            if path.exists():
                stat = path.stat()
                data[item] = {"exists": True, "size_bytes": stat.st_size, "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()}
            else:
                data[item] = {"exists": False}
        return data

    def _start_auto_backup(self, interval_seconds: int) -> None:
        if self._auto_backup_thread and self._auto_backup_thread.is_alive():
            return
        self._auto_backup_stop.clear()
        def _backup_loop():
            while not self._auto_backup_stop.wait(interval_seconds):
                try:
                    self.backup()
                except Exception as e:
                    logger.error(f"Auto backup failed: {e}")
        self._auto_backup_thread = threading.Thread(target=_backup_loop, daemon=True, name="persistence-auto-backup")
        self._auto_backup_thread.start()

    def stop_auto_backup(self) -> None:
        self._auto_backup_stop.set()
        if self._auto_backup_thread:
            self._auto_backup_thread.join(timeout=5)

    def shutdown(self) -> None:
        self.stop_auto_backup()
        if self._config.get("backup_on_shutdown", True) and self._backend:
            try:
                self.backup()
            except Exception as e:
                logger.error(f"Shutdown backup failed: {e}")
        self._initialized = False


persistence_manager = PersistenceManager()