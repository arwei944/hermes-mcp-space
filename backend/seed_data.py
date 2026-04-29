# -*- coding: utf-8 -*-
"""Hermes Agent - 种子数据初始化

首次启动时只创建必要的目录结构和配置文件模板。
不生成任何假数据——所有数据由真实使用产生。
"""

import json
import os
from pathlib import Path


def get_hermes_home() -> Path:
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    return Path(home)


def init_seed_data():
    """初始化种子数据（仅在文件不存在时创建空结构）"""
    home = get_hermes_home()
    changed = False

    # 1. 目录结构
    for subdir in ["memories", "skills", "data", "logs", "cron", "plugins"]:
        (home / subdir).mkdir(parents=True, exist_ok=True)

    # 2. 记忆文件（空模板）
    memory_file = home / "memories" / "MEMORY.md"
    if not memory_file.exists():
        memory_file.write_text("# Agent 长期记忆\n\n> 由系统自动维护的用户偏好和重要信息。\n", encoding="utf-8")
        changed = True

    user_file = home / "memories" / "USER.md"
    if not user_file.exists():
        user_file.write_text("# 用户画像\n\n> 由系统自动维护的用户信息。\n", encoding="utf-8")
        changed = True

    # 3. 空数据文件
    sessions_file = home / "data" / "sessions.json"
    if not sessions_file.exists():
        sessions_file.write_text('{"sessions":[],"messages":{}}', encoding="utf-8")
        changed = True

    log_file = home / "data" / "logs.json"
    if not log_file.exists():
        log_file.write_text("[]", encoding="utf-8")
        changed = True

    cron_file = home / "data" / "cron_jobs.json"
    if not cron_file.exists():
        cron_file.write_text("[]", encoding="utf-8")
        changed = True

    learnings_file = home / "learnings.md"
    if not learnings_file.exists():
        learnings_file.write_text("# Hermes Agent 学习记录\n\n> 自动从对话和工具调用中提炼的经验和知识。\n", encoding="utf-8")
        changed = True

    # 4. 技能文件（只创建目录，不预置内容）
    # 技能由用户或 auto_learner 自动创建

    return changed
