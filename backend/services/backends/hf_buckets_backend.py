# -*- coding: utf-8 -*-
"""Hermes Agent - HF Storage Buckets 持久化后端"""

import json, logging, os, shutil, tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes.persistence.hf_buckets")

class HFBucketsBackend:
    name = "hf_buckets"
    description = "HF Storage Buckets"
    PERSIST_ITEMS = [
        "data/knowledge.db", "data/sessions.db", "data/sessions.json", "data/logs.json",
        "data/cron_jobs.json", "mcp_servers.json", "memories/MEMORY.md", "memories/USER.md",
        "learnings.md", "logs/tool_traces.jsonl",
    ]

    def __init__(self, config: Dict[str, Any]):
        self._repo_id = config.get("repo_id", "") or os.environ.get("PERSISTENCE_HF_REPO_ID", "")
        self._token = config.get("token", "") or os.environ.get("HF_TOKEN", "")
        self._api = None

    @property
    def configured(self) -> bool:
        return bool(self._repo_id) and bool(self._token)

    @property
    def config_info(self) -> Dict[str, str]:
        return {"backend": self.name, "repo_id": self._repo_id, "token_set": "yes" if self._token else "no"}

    def _get_api(self):
        if self._api is None:
            try:
                from huggingface_hub import HfApi
                self._api = HfApi(token=self._token)
            except ImportError:
                logger.error("huggingface_hub not installed")
                return None
        return self._api

    def _ensure_repo(self) -> bool:
        api = self._get_api()
        if not api: return False
        try:
            api.repo_info(repo_id=self._repo_id, repo_type="dataset")
            return True
        except Exception:
            try:
                api.create_repo(repo_id=self._repo_id, repo_type="dataset", private=True, exist_ok=True)
                return True
            except Exception as e:
                logger.error(f"Failed to create HF repo: {e}")
                return False

    def backup(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.configured: return {"success": False, "error": "HF Buckets 未配置"}
        api = self._get_api()
        if not api: return {"success": False, "error": "huggingface_hub 未安装"}
        start_time = datetime.now()
        persist_items = items or self.PERSIST_ITEMS
        uploaded, errors = [], []
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
            if not self._ensure_repo(): return {"success": False, "error": "无法创建/访问 HF Dataset 仓库"}
            for item in persist_items:
                src = hermes_home / item
                if not src.exists(): continue
                try:
                    if src.is_dir():
                        for fp in src.rglob("*"):
                            if fp.is_file():
                                rel = item + "/" + fp.relative_to(src).as_posix()
                                api.upload_file(path_or_fileobj=str(fp), path_in_repo=rel, repo_id=self._repo_id, repo_type="dataset", commit_message=f"backup: {rel}")
                                uploaded.append(rel)
                    else:
                        api.upload_file(path_or_fileobj=str(src), path_in_repo=item, repo_id=self._repo_id, repo_type="dataset", commit_message=f"backup: {item}")
                        uploaded.append(item)
                except Exception as e:
                    errors.append(f"{item}: {str(e)}")
            duration = (datetime.now() - start_time).total_seconds() * 1000
            return {"success": len(errors) == 0 and len(uploaded) > 0, "message": f"备份完成 ({len(uploaded)} 个文件)", "files": uploaded, "errors": errors, "duration_ms": duration}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def restore(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.configured: return {"success": False, "error": "HF Buckets 未配置"}
        api = self._get_api()
        if not api: return {"success": False, "error": "huggingface_hub 未安装"}
        start_time = datetime.now()
        persist_items = items or self.PERSIST_ITEMS
        restored, errors = [], []
        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                for item in persist_items:
                    try:
                        dst = hermes_home / item
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        local_path = api.hf_hub_download(repo_id=self._repo_id, filename=item, repo_type="dataset", local_dir=str(tmp_path))
                        src = Path(local_path)
                        if src.exists():
                            if src.is_dir():
                                if dst.exists(): shutil.rmtree(dst, ignore_errors=True)
                                shutil.copytree(str(src), str(dst))
                            else:
                                shutil.copy2(str(src), str(dst))
                            restored.append(item)
                    except Exception as e:
                        err_str = str(e)
                        if "404" not in err_str and "not found" not in err_str.lower():
                            errors.append(f"{item}: {err_str}")
            duration = (datetime.now() - start_time).total_seconds() * 1000
            return {"success": True, "message": f"恢复完成 ({len(restored)} 个文件)", "files": restored, "errors": errors, "duration_ms": duration}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_status(self, hermes_home: Path) -> Dict[str, Any]:
        api = self._get_api()
        status = {"backend": self.name, "configured": self.configured, "config": self.config_info}
        if api and self._repo_id:
            try:
                info = api.repo_info(repo_id=self._repo_id, repo_type="dataset")
                status["repo_exists"] = True
                status["last_modified"] = str(info.last_modified) if info.last_modified else ""
                files = api.list_repo_files(repo_id=self._repo_id, repo_type="dataset")
                status["file_count"] = len(files)
            except Exception:
                status["repo_exists"] = False
        return status