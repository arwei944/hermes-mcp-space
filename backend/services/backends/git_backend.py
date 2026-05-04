# -*- coding: utf-8 -*-
"""Hermes Agent - Git 仓库同步持久化后端"""

import logging, os, shutil, subprocess, tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes.persistence.git")

class GitBackend:
    name = "git"
    description = "Git 仓库同步"
    PERSIST_ITEMS = [
        "data/knowledge.db", "data/sessions.db", "data/sessions.json", "data/logs.json",
        "data/cron_jobs.json", "mcp_servers.json", "memories/MEMORY.md", "memories/USER.md",
        "learnings.md", "logs/tool_traces.jsonl",
    ]

    def __init__(self, config: Dict[str, Any]):
        self._repo_url = config.get("repo_url", "") or os.environ.get("PERSISTENCE_GIT_REPO_URL", "")
        self._branch = config.get("branch", "main") or os.environ.get("PERSISTENCE_GIT_BRANCH", "main")
        self._work_dir: Optional[Path] = None

    @property
    def configured(self) -> bool: return bool(self._repo_url)

    @property
    def config_info(self) -> Dict[str, str]:
        safe_url = self._repo_url
        if "@" in safe_url:
            parts = safe_url.split("@")
            safe_url = f"***@{parts[1]}"
        return {"backend": self.name, "repo_url": safe_url, "branch": self._branch}

    def _get_work_dir(self, hermes_home: Path) -> Path:
        if self._work_dir is None:
            self._work_dir = hermes_home / ".persistence" / "git"
        return self._work_dir

    def _init_repo(self, hermes_home: Path) -> bool:
        work_dir = self._get_work_dir(hermes_home)
        git_dir = work_dir / ".git"
        try:
            if git_dir.exists():
                result = subprocess.run(["git", "remote", "get-url", "origin"], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    if result.stdout.strip() != self._repo_url:
                        subprocess.run(["git", "remote", "set-url", "origin", self._repo_url], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
                    return True
            if work_dir.exists(): shutil.rmtree(work_dir, ignore_errors=True)
            work_dir.mkdir(parents=True, exist_ok=True)
            result = subprocess.run(["git", "clone", "--depth", "1", "--branch", self._branch, self._repo_url, str(work_dir)], capture_output=True, text=True, timeout=60)
            if result.returncode != 0:
                subprocess.run(["git", "init", str(work_dir)], capture_output=True, text=True, timeout=10)
                subprocess.run(["git", "remote", "add", "origin", self._repo_url], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
                (work_dir / ".gitkeep").write_text("")
                subprocess.run(["git", "add", "-A"], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
                subprocess.run(["git", "commit", "-m", "init: hermes data persistence"], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
                subprocess.run(["git", "branch", "-M", self._branch], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
                subprocess.run(["git", "push", "-u", "origin", self._branch, "--force"], cwd=str(work_dir), capture_output=True, text=True, timeout=30)
            return True
        except Exception as e:
            logger.error(f"Failed to init git repo: {e}")
            return False

    def backup(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.configured: return {"success": False, "error": "Git 后端未配置"}
        start_time = datetime.now()
        work_dir = self._get_work_dir(hermes_home)
        persist_items = items or self.PERSIST_ITEMS
        copied, errors = [], []
        try:
            for db_name in ("data/knowledge.db", "data/sessions.db"):
                db_path = hermes_home / db_name
                if db_path.exists():
                    try:
                        import sqlite3
                        conn = sqlite3.connect(str(db_path), timeout=5)
                        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                        conn.close()
                    except Exception as e:
                        logger.warning(f"SQLite WAL checkpoint failed for {db_name}: {e}")
            if not self._init_repo(hermes_home): return {"success": False, "error": "无法初始化 Git 仓库"}
            for item in persist_items:
                src, dst = hermes_home / item, work_dir / item
                if src.exists():
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if src.is_dir():
                        if dst.exists(): shutil.rmtree(dst, ignore_errors=True)
                        shutil.copytree(str(src), str(dst))
                    else:
                        shutil.copy2(str(src), str(dst))
                    copied.append(item)
            if not copied: return {"success": True, "message": "没有需要备份的文件"}
            subprocess.run(["git", "add", "-A"], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
            status = subprocess.run(["git", "status", "--porcelain"], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
            if not status.stdout.strip(): return {"success": True, "message": "数据无变更"}
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            subprocess.run(["git", "commit", "-m", f"backup: auto backup at {timestamp}", "--allow-empty"], cwd=str(work_dir), capture_output=True, text=True, timeout=10)
            push_result = subprocess.run(["git", "push", "origin", self._branch, "--force"], cwd=str(work_dir), capture_output=True, text=True, timeout=30)
            if push_result.returncode != 0: errors.append(f"git push failed: {push_result.stderr}")
            duration = (datetime.now() - start_time).total_seconds() * 1000
            return {"success": len(errors) == 0, "message": f"备份完成 ({len(copied)} 个文件)", "files": copied, "errors": errors, "duration_ms": duration}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def restore(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.configured: return {"success": False, "error": "Git 后端未配置"}
        start_time = datetime.now()
        work_dir = self._get_work_dir(hermes_home)
        persist_items = items or self.PERSIST_ITEMS
        restored, errors = [], []
        try:
            if not self._init_repo(hermes_home): return {"success": False, "error": "无法初始化 Git 仓库"}
            subprocess.run(["git", "pull", "origin", self._branch, "--force"], cwd=str(work_dir), capture_output=True, text=True, timeout=30)
            for item in persist_items:
                src, dst = work_dir / item, hermes_home / item
                if src.exists():
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if src.is_dir():
                        if dst.exists(): shutil.rmtree(dst, ignore_errors=True)
                        shutil.copytree(str(src), str(dst))
                    else:
                        shutil.copy2(str(src), str(dst))
                    restored.append(item)
            duration = (datetime.now() - start_time).total_seconds() * 1000
            return {"success": True, "message": f"恢复完成 ({len(restored)} 个文件)", "files": restored, "errors": errors, "duration_ms": duration}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_status(self, hermes_home: Path) -> Dict[str, Any]:
        work_dir = self._get_work_dir(hermes_home)
        status = {"backend": self.name, "configured": self.configured, "config": self.config_info, "repo_exists": (work_dir / ".git").exists()}
        return status