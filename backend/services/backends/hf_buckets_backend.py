# -*- coding: utf-8 -*-
"""Hermes Agent - HF Storage Buckets 持久化后端

使用 HuggingFace Storage Buckets（S3 风格对象存储）实现数据持久化。
这是 HF 官方推荐的持久化方案，替代已弃用的 Persistent Storage。

配置方式（环境变量或 config.yaml）：
    PERSISTENCE_HF_REPO_ID: HF 仓库 ID（如 arwei944/hermes-data）
    HF_TOKEN: HF API Token（已有）
"""

import json
import logging
import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes.persistence.hf_buckets")


class HFBucketsBackend:
    """HF Storage Buckets 后端

    通过 huggingface_hub 的 HfApi 实现：
    - backup(): 上传数据文件到 HF Dataset 仓库
    - restore(): 从 HF Dataset 仓库下载数据文件
    """

    name = "hf_buckets"
    description = "HF Storage Buckets（官方原生，S3 风格）"

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

    def __init__(self, config: Dict[str, Any]):
        self._repo_id = config.get("repo_id", "") or os.environ.get(
            "PERSISTENCE_HF_REPO_ID", ""
        )
        self._token = config.get("token", "") or os.environ.get("HF_TOKEN", "")
        self._api = None

    @property
    def configured(self) -> bool:
        """检查是否已配置"""
        return bool(self._repo_id) and bool(self._token)

    @property
    def config_info(self) -> Dict[str, str]:
        """返回配置信息"""
        return {
            "backend": self.name,
            "repo_id": self._repo_id,
            "token_set": "yes" if self._token else "no",
        }

    def _get_api(self):
        """懒加载 HfApi"""
        if self._api is None:
            try:
                from huggingface_hub import HfApi
                self._api = HfApi(token=self._token)
            except ImportError:
                logger.error("huggingface_hub not installed. Run: pip install huggingface_hub")
                return None
        return self._api

    def _ensure_repo(self) -> bool:
        """确保 HF Dataset 仓库存在"""
        api = self._get_api()
        if not api:
            return False

        try:
            # 尝试获取仓库信息
            api.repo_info(repo_id=self._repo_id, repo_type="dataset")
            return True
        except Exception:
            # 仓库不存在，创建
            try:
                api.create_repo(
                    repo_id=self._repo_id,
                    repo_type="dataset",
                    private=True,
                    exist_ok=True,
                )
                logger.info(f"Created HF Dataset repo: {self._repo_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to create HF repo: {e}")
                return False

    def backup(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        """备份数据到 HF Storage Buckets

        Args:
            hermes_home: Hermes 主目录路径
            items: 要备份的文件列表（默认全部）

        Returns:
            备份结果字典
        """
        if not self.configured:
            return {"success": False, "error": "HF Buckets 后端未配置（缺少 repo_id 或 HF_TOKEN）"}

        api = self._get_api()
        if not api:
            return {"success": False, "error": "huggingface_hub 未安装"}

        start_time = datetime.now()
        persist_items = items or self.PERSIST_ITEMS
        uploaded_files = []
        errors = []

        try:
            # 确保仓库存在
            if not self._ensure_repo():
                return {"success": False, "error": "无法创建/访问 HF Dataset 仓库"}

            # 上传每个文件
            for item in persist_items:
                src = hermes_home / item
                if not src.exists():
                    logger.debug(f"Skip non-existent: {item}")
                    continue

                try:
                    if src.is_dir():
                        # 目录：逐个上传目录中的文件
                        for file_path in src.rglob("*"):
                            if file_path.is_file():
                                rel_path = item + "/" + file_path.relative_to(src).as_posix()
                                api.upload_file(
                                    path_or_fileobj=str(file_path),
                                    path_in_repo=rel_path,
                                    repo_id=self._repo_id,
                                    repo_type="dataset",
                                    commit_message=f"backup: {rel_path}",
                                )
                                uploaded_files.append(rel_path)
                    else:
                        # 单文件
                        api.upload_file(
                            path_or_fileobj=str(src),
                            path_in_repo=item,
                            repo_id=self._repo_id,
                            repo_type="dataset",
                            commit_message=f"backup: {item}",
                        )
                        uploaded_files.append(item)
                except Exception as e:
                    errors.append(f"{item}: {str(e)}")
                    logger.error(f"Failed to upload {item}: {e}")

            duration = (datetime.now() - start_time).total_seconds() * 1000

            return {
                "success": len(errors) == 0 and len(uploaded_files) > 0,
                "message": f"备份完成 ({len(uploaded_files)} 个文件)" if uploaded_files else "没有需要备份的文件",
                "files": uploaded_files,
                "errors": errors,
                "duration_ms": duration,
                "repo_id": self._repo_id,
            }
        except Exception as e:
            logger.error(f"HF backup failed: {e}")
            return {"success": False, "error": str(e)}

    def restore(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        """从 HF Storage Buckets 恢复数据

        Args:
            hermes_home: Hermes 主目录路径
            items: 要恢复的文件列表（默认全部）

        Returns:
            恢复结果字典
        """
        if not self.configured:
            return {"success": False, "error": "HF Buckets 后端未配置（缺少 repo_id 或 HF_TOKEN）"}

        api = self._get_api()
        if not api:
            return {"success": False, "error": "huggingface_hub 未安装"}

        start_time = datetime.now()
        persist_items = items or self.PERSIST_ITEMS
        restored_files = []
        errors = []

        try:
            # 使用临时目录下载
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)

                for item in persist_items:
                    try:
                        dst = hermes_home / item
                        dst.parent.mkdir(parents=True, exist_ok=True)

                        # 尝试下载文件
                        local_path = api.hf_hub_download(
                            repo_id=self._repo_id,
                            filename=item,
                            repo_type="dataset",
                            local_dir=str(tmp_path),
                        )
                        src = Path(local_path)

                        if src.exists():
                            if src.is_dir():
                                if dst.exists():
                                    shutil.rmtree(dst, ignore_errors=True)
                                shutil.copytree(str(src), str(dst))
                            else:
                                shutil.copy2(str(src), str(dst))
                            restored_files.append(item)
                    except Exception as e:
                        # 文件可能不存在于仓库中，跳过
                        err_str = str(e)
                        if "404" in err_str or "not found" in err_str.lower():
                            logger.debug(f"Skip non-existent in repo: {item}")
                        else:
                            errors.append(f"{item}: {err_str}")
                            logger.error(f"Failed to download {item}: {e}")

            duration = (datetime.now() - start_time).total_seconds() * 1000

            return {
                "success": True,
                "message": f"恢复完成 ({len(restored_files)} 个文件)",
                "files": restored_files,
                "errors": errors,
                "duration_ms": duration,
                "repo_id": self._repo_id,
            }
        except Exception as e:
            logger.error(f"HF restore failed: {e}")
            return {"success": False, "error": str(e)}

    def get_status(self, hermes_home: Path) -> Dict[str, Any]:
        """获取 HF Buckets 后端状态"""
        api = self._get_api()
        status = {
            "backend": self.name,
            "configured": self.configured,
            "config": self.config_info,
        }

        if api and self._repo_id:
            try:
                repo_info = api.repo_info(repo_id=self._repo_id, repo_type="dataset")
                status["repo_exists"] = True
                status["repo_id"] = self._repo_id
                status["last_modified"] = str(repo_info.last_modified) if repo_info.last_modified else ""
                status["private"] = repo_info.private

                # 列出文件
                try:
                    files = api.list_repo_files(repo_id=self._repo_id, repo_type="dataset")
                    status["file_count"] = len(files)
                    status["files"] = files
                except Exception:
                    pass
            except Exception:
                status["repo_exists"] = False

        return status
