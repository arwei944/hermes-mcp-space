# -*- coding: utf-8 -*-
"""Hermes Agent - 版本管理 API"""

import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/version", tags=["version"])


@router.get("", summary="获取当前版本")
async def get_version():
    from backend.version import get_version_info
    return get_version_info()


@router.get("/changelog", summary="获取变更记录")
async def get_changelog():
    """从 about.js 的 CHANGELOG 中提取版本记录"""
    from pathlib import Path
    import re

    about_file = Path(__file__).resolve().parent.parent.parent / "frontend" / "js" / "pages" / "about.js"
    if not about_file.exists():
        return {"versions": []}

    content = about_file.read_text(encoding="utf-8")

    # 提取 CHANGELOG 数组
    match = re.search(r"const CHANGELOG = \\[[\\s\\S]*?\\];", content)
    if not match:
        return {"versions": []}

    # 简单解析 version/date/title/changes
    versions = []
    for block in re.finditer(r"\\{([\\s\\S]*?)\\}", match.group(1)):
        block_text = block.group(1)
        ver = re.search(r"version:\\s*['\"]([^'\"]+)", block_text)
        date = re.search(r"date:\\s*['\"]([^'\"]+)", block_text)
        title = re.search(r"title:\\s*['\"]([^'\"]+)", block_text)
        changes = re.findall(r"'([^']+)'(?=,|\\s*\\])", block_text)
        # 过滤掉 version/date/title 本身
        changes = [c for c in changes if c not in ("version", "date", "title") and not c.startswith("version:") and not c.startswith("date:") and not c.startswith("title:")]
        if ver:
            versions.append({
                "version": ver.group(1),
                "date": date.group(1) if date else "",
                "title": title.group(1) if title else "",
                "changes": changes,
            })

    return {"versions": versions}


@router.get("/check-update", summary="检查 GitHub 更新")
async def check_update():
    """检查 GitHub 仓库是否有新版本"""
    import subprocess
    from backend.version import get_version

    current_version = get_version()

    try:
        # Fetch latest tags from GitHub
        result = subprocess.run(
            ["git", "fetch", "--tags", "--quiet"],
            capture_output=True, text=True, timeout=30, cwd="/app"
        )

        # Get latest tag
        result = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0"],
            capture_output=True, text=True, timeout=10, cwd="/app"
        )
        latest_tag = result.stdout.strip().lstrip('v') if result.returncode == 0 else None

        # Get latest commit info
        result = subprocess.run(
            ["git", "log", "-1", "--format=%H %s %ci"],
            capture_output=True, text=True, timeout=10, cwd="/app"
        )
        commit_info = result.stdout.strip() if result.returncode == 0 else ""

        has_update = False
        if latest_tag:
            # Simple version comparison
            try:
                current_parts = [int(x) for x in current_version.split('.')]
                latest_parts = [int(x) for x in latest_tag.split('.')]
                has_update = latest_parts > current_parts
            except (ValueError, AttributeError):
                has_update = latest_tag != current_version

        return {
            "current_version": current_version,
            "latest_version": latest_tag,
            "has_update": has_update,
            "commit_info": commit_info,
        }
    except Exception as e:
        logger.warning(f"检查更新失败: {e}")
        return {
            "current_version": current_version,
            "latest_version": None,
            "has_update": False,
            "error": str(e),
        }


@router.post("/hot-update", summary="执行热更新")
async def hot_update():
    """执行热更新: 备份 → git pull → 返回结果"""
    import subprocess
    import json
    from backend.version import get_version

    steps = []
    success = True

    # Step 1: Pre-update backup
    try:
        from backend.services.persistence_manager import PersistenceManager
        pm = PersistenceManager()
        backup_result = await pm.pre_update_backup()
        steps.append({"step": "更新前备份", "status": "success", "detail": str(backup_result)})
    except Exception as e:
        steps.append({"step": "更新前备份", "status": "warning", "detail": f"备份失败(继续更新): {e}"})

    # Step 2: Git pull
    try:
        result = subprocess.run(
            ["git", "pull", "--rebase", "origin", "main"],
            capture_output=True, text=True, timeout=120, cwd="/app"
        )
        if result.returncode == 0:
            steps.append({"step": "拉取代码", "status": "success", "detail": result.stdout.strip() or "已是最新"})
        else:
            steps.append({"step": "拉取代码", "status": "failed", "detail": result.stderr.strip()})
            success = False
    except Exception as e:
        steps.append({"step": "拉取代码", "status": "failed", "detail": str(e)})
        success = False

    # Step 3: Get new version
    new_version = get_version()

    return {
        "success": success,
        "old_version": steps[0] and get_version() or new_version,
        "new_version": new_version,
        "steps": steps,
        "message": "更新成功，建议刷新页面" if success else "更新失败，请检查日志",
    }