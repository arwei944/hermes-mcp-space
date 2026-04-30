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