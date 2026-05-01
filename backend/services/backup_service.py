# -*- coding: utf-8 -*-
"""数据自动备份服务"""
import os
import json
import shutil
import gzip
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or os.path.join(os.path.expanduser("~"), ".hermes")
        self.backup_dir = os.path.join(self.data_dir, "backups")
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_backup(self, items: list = None) -> dict:
        """创建备份"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}"
        backup_path = os.path.join(self.backup_dir, backup_name)
        os.makedirs(backup_path, exist_ok=True)

        backed_up = []
        errors = []

        # 备份会话数据
        if items is None or "sessions" in items:
            try:
                sessions_file = os.path.join(self.data_dir, "sessions.json")
                if os.path.exists(sessions_file):
                    shutil.copy2(sessions_file, backup_path)
                    backed_up.append("sessions")
            except Exception as e:
                errors.append(f"sessions: {str(e)}")

        # 备份记忆数据
        if items is None or "memory" in items:
            try:
                memory_file = os.path.join(self.data_dir, "memory.json")
                if os.path.exists(memory_file):
                    shutil.copy2(memory_file, backup_path)
                    backed_up.append("memory")
            except Exception as e:
                errors.append(f"memory: {str(e)}")

        # 备份配置
        if items is None or "config" in items:
            try:
                config_file = os.path.join(self.data_dir, "config.json")
                if os.path.exists(config_file):
                    shutil.copy2(config_file, backup_path)
                    backed_up.append("config")
            except Exception as e:
                errors.append(f"config: {str(e)}")

        # 创建备份元数据
        metadata = {
            "name": backup_name,
            "created_at": datetime.now().isoformat(),
            "items": backed_up,
            "errors": errors,
            "size": sum(os.path.getsize(os.path.join(backup_path, f))
                       for f in os.listdir(backup_path)
                       if os.path.isfile(os.path.join(backup_path, f)))
        }
        with open(os.path.join(backup_path, "metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        return {
            "success": True,
            "backup_name": backup_name,
            "items": backed_up,
            "errors": errors,
            "size": metadata["size"]
        }

    def list_backups(self) -> list:
        """列出所有备份"""
        backups = []
        if not os.path.exists(self.backup_dir):
            return backups
        for name in sorted(os.listdir(self.backup_dir), reverse=True):
            meta_path = os.path.join(self.backup_dir, name, "metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path) as f:
                    backups.append(json.load(f))
        return backups

    def restore_backup(self, backup_name: str, items: list = None) -> dict:
        """从备份恢复"""
        backup_path = os.path.join(self.backup_dir, backup_name)
        if not os.path.exists(backup_path):
            return {"success": False, "error": f"备份 '{backup_name}' 不存在"}

        restored = []
        errors = []

        for item in (items or ["sessions", "memory", "config"]):
            src = os.path.join(backup_path, f"{item}.json")
            dst = os.path.join(self.data_dir, f"{item}.json")
            if os.path.exists(src):
                try:
                    shutil.copy2(src, dst)
                    restored.append(item)
                except Exception as e:
                    errors.append(f"{item}: {str(e)}")

        return {"success": len(errors) == 0, "restored": restored, "errors": errors}

    def cleanup_old_backups(self, keep_count: int = 10) -> int:
        """清理旧备份，保留最新的 N 个"""
        backups = self.list_backups()
        if len(backups) <= keep_count:
            return 0
        removed = 0
        for backup in backups[keep_count:]:
            path = os.path.join(self.backup_dir, backup["name"])
            try:
                shutil.rmtree(path)
                removed += 1
            except Exception:
                pass
        return removed

backup_service = BackupService()
