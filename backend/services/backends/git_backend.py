# -*- coding: utf-8 -*-
"""Hermes Agent - Git 仓库同步持久化后端

将 ~/.hermes/ 数据同步到专用 Git 仓库，实现跨容器重建的数据持久化。

配置方式（环境变量或 config.yaml）：
    PERSISTENCE_GIT_REPO_URL: Git 仓库 URL（含 Token）
    PERSISTENCE_GIT_BRANCH: 分支名（默认 main）
"""

import logging
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes.persistence.git")


class GitBackend:
    """Git 仓库同步后端

    通过 git clone/pull/push 实现：
    - backup(): 将本地数据 commit + push 到远程仓库
    - restore(): 从远程仓库 pull 数据到本地
    """

    name = "git"
    description = "Git 仓库同步（免费，有版本历史）"

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
        self._repo_url = config.get("repo_url", "") or os.environ.get(
            "PERSISTENCE_GIT_REPO_URL", ""
        )
        self._branch = config.get("branch", "main") or os.environ.get(
            "PERSISTENCE_GIT_BRANCH", "main"
        )
        self._work_dir: Optional[Path] = None

    @property
    def configured(self) -> bool:
        """检查是否已配置"""
        return bool(self._repo_url)

    @property
    def config_info(self) -> Dict[str, str]:
        """返回配置信息（隐藏敏感信息）"""
        # 隐藏 URL 中的 token
        safe_url = self._repo_url
        if "@" in safe_url:
            # https://user:token@github.com/... → https://***@github.com/...
            parts = safe_url.split("@")
            safe_url = f"***@{parts[1]}"
        return {
            "backend": self.name,
            "repo_url": safe_url,
            "branch": self._branch,
        }

    def _get_work_dir(self, hermes_home: Path) -> Path:
        """获取 Git 工作目录"""
        if self._work_dir is None:
            self._work_dir = hermes_home / ".persistence" / "git"
        return self._work_dir

    def _init_repo(self, hermes_home: Path) -> bool:
        """初始化或克隆 Git 仓库"""
        work_dir = self._get_work_dir(hermes_home)
        git_dir = work_dir / ".git"

        try:
            if git_dir.exists():
                # 已有仓库，检查远程配置
                result = subprocess.run(
                    ["git", "remote", "get-url", "origin"],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode == 0:
                    current_url = result.stdout.strip()
                    if current_url != self._repo_url:
                        # 更新远程 URL
                        subprocess.run(
                            ["git", "remote", "set-url", "origin", self._repo_url],
                            cwd=str(work_dir),
                            capture_output=True,
                            text=True,
                            timeout=10,
                        )
                    return True

            # 克隆仓库
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)
            work_dir.mkdir(parents=True, exist_ok=True)

            result = subprocess.run(
                [
                    "git", "clone", "--depth", "1",
                    "--branch", self._branch,
                    self._repo_url,
                    str(work_dir),
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )

            if result.returncode != 0:
                # 仓库可能不存在，初始化新仓库
                logger.warning(f"Git clone failed ({result.stderr}), initializing new repo")
                subprocess.run(
                    ["git", "init", str(work_dir)],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                subprocess.run(
                    ["git", "remote", "add", "origin", self._repo_url],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                # 创建 .gitkeep
                (work_dir / ".gitkeep").write_text("")
                subprocess.run(
                    ["git", "add", "-A"],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                subprocess.run(
                    ["git", "commit", "-m", "init: hermes data persistence"],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                subprocess.run(
                    ["git", "branch", "-M", self._branch],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                # 首次推送
                subprocess.run(
                    ["git", "push", "-u", "origin", self._branch, "--force"],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

            return True
        except Exception as e:
            logger.error(f"Failed to init git repo: {e}")
            return False

    def backup(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        """备份数据到 Git 仓库

        Args:
            hermes_home: Hermes 主目录路径
            items: 要备份的文件列表（默认全部）

        Returns:
            备份结果字典
        """
        if not self.configured:
            return {"success": False, "error": "Git 后端未配置（缺少 repo_url）"}

        start_time = datetime.now()
        work_dir = self._get_work_dir(hermes_home)
        persist_items = items or self.PERSIST_ITEMS
        copied_files = []
        errors = []

        try:
            # 初始化仓库
            if not self._init_repo(hermes_home):
                return {"success": False, "error": "无法初始化 Git 仓库"}

            # 复制文件到工作目录
            for item in persist_items:
                src = hermes_home / item
                dst = work_dir / item
                if src.exists():
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if src.is_dir():
                        if dst.exists():
                            shutil.rmtree(dst, ignore_errors=True)
                        shutil.copytree(str(src), str(dst))
                    else:
                        shutil.copy2(str(src), str(dst))
                    copied_files.append(item)
                else:
                    logger.debug(f"Skip non-existent: {item}")

            if not copied_files:
                return {
                    "success": True,
                    "message": "没有需要备份的文件",
                    "files": [],
                    "duration_ms": (datetime.now() - start_time).total_seconds() * 1000,
                }

            # Git add + commit + push
            subprocess.run(
                ["git", "add", "-A"],
                cwd=str(work_dir),
                capture_output=True,
                text=True,
                timeout=10,
            )

            # 检查是否有变更
            status = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(work_dir),
                capture_output=True,
                text=True,
                timeout=10,
            )

            if not status.stdout.strip():
                return {
                    "success": True,
                    "message": "数据无变更，跳过提交",
                    "files": copied_files,
                    "duration_ms": (datetime.now() - start_time).total_seconds() * 1000,
                }

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            commit_msg = f"backup: auto backup at {timestamp} ({len(copied_files)} files)"

            result = subprocess.run(
                ["git", "commit", "-m", commit_msg, "--allow-empty"],
                cwd=str(work_dir),
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                errors.append(f"git commit failed: {result.stderr}")

            # Push
            push_result = subprocess.run(
                ["git", "push", "origin", self._branch, "--force"],
                cwd=str(work_dir),
                capture_output=True,
                text=True,
                timeout=30,
            )

            if push_result.returncode != 0:
                errors.append(f"git push failed: {push_result.stderr}")

            duration = (datetime.now() - start_time).total_seconds() * 1000

            return {
                "success": len(errors) == 0,
                "message": f"备份完成 ({len(copied_files)} 个文件)" if not errors else f"备份完成但有错误",
                "files": copied_files,
                "errors": errors,
                "duration_ms": duration,
                "commit_msg": commit_msg,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Git 操作超时"}
        except Exception as e:
            logger.error(f"Git backup failed: {e}")
            return {"success": False, "error": str(e)}

    def restore(self, hermes_home: Path, items: Optional[List[str]] = None) -> Dict[str, Any]:
        """从 Git 仓库恢复数据

        Args:
            hermes_home: Hermes 主目录路径
            items: 要恢复的文件列表（默认全部）

        Returns:
            恢复结果字典
        """
        if not self.configured:
            return {"success": False, "error": "Git 后端未配置（缺少 repo_url）"}

        start_time = datetime.now()
        work_dir = self._get_work_dir(hermes_home)
        persist_items = items or self.PERSIST_ITEMS
        restored_files = []
        errors = []

        try:
            # 初始化/更新仓库
            if not self._init_repo(hermes_home):
                return {"success": False, "error": "无法初始化 Git 仓库"}

            # Pull 最新数据
            subprocess.run(
                ["git", "pull", "origin", self._branch, "--force"],
                cwd=str(work_dir),
                capture_output=True,
                text=True,
                timeout=30,
            )

            # 复制文件到 hermes_home
            for item in persist_items:
                src = work_dir / item
                dst = hermes_home / item
                if src.exists():
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if src.is_dir():
                        if dst.exists():
                            shutil.rmtree(dst, ignore_errors=True)
                        shutil.copytree(str(src), str(dst))
                    else:
                        shutil.copy2(str(src), str(dst))
                    restored_files.append(item)
                else:
                    logger.debug(f"Skip non-existent in repo: {item}")

            duration = (datetime.now() - start_time).total_seconds() * 1000

            return {
                "success": True,
                "message": f"恢复完成 ({len(restored_files)} 个文件)",
                "files": restored_files,
                "errors": errors,
                "duration_ms": duration,
            }
        except Exception as e:
            logger.error(f"Git restore failed: {e}")
            return {"success": False, "error": str(e)}

    def get_status(self, hermes_home: Path) -> Dict[str, Any]:
        """获取 Git 后端状态"""
        work_dir = self._get_work_dir(hermes_home)
        git_dir = work_dir / ".git"

        status = {
            "backend": self.name,
            "configured": self.configured,
            "config": self.config_info,
            "repo_exists": git_dir.exists(),
        }

        if git_dir.exists():
            try:
                # 获取最后一次提交信息
                result = subprocess.run(
                    ["git", "log", "-1", "--format=%H|%ai|%s"],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode == 0 and result.stdout.strip():
                    parts = result.stdout.strip().split("|", 2)
                    status["last_commit"] = {
                        "hash": parts[0][:8] if len(parts) > 0 else "",
                        "date": parts[1] if len(parts) > 1 else "",
                        "message": parts[2] if len(parts) > 2 else "",
                    }

                # 获取文件数量
                result = subprocess.run(
                    ["git", "ls-files"],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode == 0:
                    files = [f for f in result.stdout.strip().split("\n") if f]
                    status["file_count"] = len(files)
                    status["files"] = files
            except Exception:
                pass

        return status
