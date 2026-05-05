# -*- coding: utf-8 -*-
"""Hermes Agent - 统一版本管理

唯一版本源。所有模块、API、前端都从这里读取版本号。

版本号规则：
  - 主版本号 (MAJOR): 架构级变更
  - 次版本号 (MINOR): 新功能
  - 修订号 (PATCH): Bug 修复

更新版本时只需修改此文件的 __version__ 即可，
配合 release.sh 自动同步到 CHANGELOG 和 Git tag。

"""

import os

# ============================================
# 唯一版本号 - 修改这里即可
# ============================================
__version__ = os.environ.get("APP_VERSION", "15.5.4")

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