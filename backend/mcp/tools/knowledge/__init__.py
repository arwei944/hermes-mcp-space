# -*- coding: utf-8 -*-
"""Knowledge 工具模块 — 经验/记忆/审核/搜索"""

from backend.mcp.tools.knowledge import (
    experience_update,
    experience_resolve,
    experience_search,
    memory_list,
    memory_get,
    memory_create,
    memory_update,
    memory_forget,
    memory_search,
    review_list,
    review_stats,
    review_approve,
    unified_search,
    knowledge_overview,
    context_budget_preview,
)

ALL_MODULES = [
    experience_update,
    experience_resolve,
    experience_search,
    memory_list,
    memory_get,
    memory_create,
    memory_update,
    memory_forget,
    memory_search,
    review_list,
    review_stats,
    review_approve,
    unified_search,
    knowledge_overview,
    context_budget_preview,
]


def register_all(reg):
    """注册所有 knowledge 工具"""
    for mod in ALL_MODULES:
        mod.register(reg)
