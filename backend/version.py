# -*- coding: utf-8 -*-
"""Hermes Agent - 统一版本管理

唯一版本源。所有模块、API、前端都从这里读取版本号。

版本号规则：
  - 主版本号 (MAJOR): 架构级变更
  - 次版本号 (MINOR): 新功能
  - 修订号 (PATCH): Bug 修复

版本号自动从 git tag 获取，无需手动修改。
发布新版本时只需打 git tag（如 v15.5.7），构建时自动识别。

"""

import os
import subprocess


def _get_version_from_git() -> str:
    """从 git tag 自动获取版本号"""
    try:
        result = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0"],
            capture_output=True, text=True, timeout=5,
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )
        if result.returncode == 0:
            tag = result.stdout.strip()
            # 去掉 v 前缀（v15.5.6 → 15.5.6）
            if tag.startswith("v"):
                tag = tag[1:]
            return tag
    except Exception:
        pass
    return ""


# ============================================
# 版本号自动获取：环境变量 > git tag > fallback
# ============================================
_git_version = _get_version_from_git()
__version__ = os.environ.get("APP_VERSION") or _git_version or "0.0.0"

# 版本元信息
__version_meta__ = {
    "name": "Hermes Agent MCP Space",
    "version": __version__,
    "description": "AI Agent 管理面板",
}


def get_version() -> str:
    """获取当前版本号"""
    return __version__


def get_version_info() -> dict:
    """获取完整版本信息"""
    return __version_meta__.copy()
