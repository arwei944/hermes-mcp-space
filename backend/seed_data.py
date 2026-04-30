# -*- coding: utf-8 -*-
"""Hermes Agent - 种子数据初始化

首次启动时创建目录结构、配置文件模板和示例数据。
示例数据让各页面有初始展示内容，用户可随时修改或删除。
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path


def get_hermes_home() -> Path:
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    return Path(home)


def init_seed_data():
    """初始化种子数据（仅在文件不存在时创建）"""
    home = get_hermes_home()
    changed = False

    # 1. 目录结构
    for subdir in ["memories", "skills", "data", "logs", "cron", "plugins"]:
        (home / subdir).mkdir(parents=True, exist_ok=True)

    # 2. 记忆文件（带示例内容）
    memory_file = home / "memories" / "MEMORY.md"
    if not memory_file.exists():
        memory_file.write_text("""# Agent 长期记忆

## 用户偏好
- 沟通风格：中文为主，技术术语可保留英文
- 工作习惯：偏好简洁直接的回答，不需要过多解释
- 常用工具：VS Code, Git, Docker, HuggingFace Spaces
- 代码风格：遵循项目既有规范，IIFE 模块模式

## 项目上下文
- 当前项目：Hermes Agent MCP Space
- 技术栈：Python + FastAPI + Gradio + Vanilla JS
- 关键约束：HF Space 部署，无持久化存储，需 Git 同步
- 前端规范：data-action 事件委托，Components 全局组件库

## 重要记录
- 2026-04-30: 完成 v5.3.1 ~ v6.0.0 全版本迭代
- 2026-04-30: 修复 version.py 正则表达式双反斜杠 Bug
- 2026-04-30: 修复 sync.js API.post 第三参数静默忽略 Bug
""", encoding="utf-8")
        changed = True

    user_file = home / "memories" / "USER.md"
    if not user_file.exists():
        user_file.write_text("""# 用户画像

## 基本信息
- 称呼：主人
- 角色：全栈开发者
- 时区：Asia/Shanghai (UTC+8)

## 技术栈
- 前端：JavaScript (Vanilla), HTML/CSS, Gradio
- 后端：Python, FastAPI, Uvicorn
- AI/ML：HuggingFace, MCP Protocol
- DevOps：Git, Docker, GitHub Actions

## 偏好
- 代码风格：简洁高效，遵循项目既有模式
- 文档语言：中文为主
- 交付格式：Markdown 文档 + 直接推送 GitHub
- 沟通方式：直接给结果，不需要过多中间确认
""", encoding="utf-8")
        changed = True

    # 3. 会话数据（示例会话）
    sessions_file = home / "data" / "sessions.json"
    if not sessions_file.exists():
        now = datetime.now()
        sample_sessions = {
            "sessions": [
                {
                    "id": "demo-session-001",
                    "title": "Hermes Agent 初始配置",
                    "source": "Web",
                    "model": "claude-sonnet-4-20250514",
                    "status": "completed",
                    "created_at": (now - timedelta(hours=2)).isoformat(),
                    "updated_at": (now - timedelta(hours=1)).isoformat(),
                },
                {
                    "id": "demo-session-002",
                    "title": "MCP 服务扫描与配置",
                    "source": "Trae",
                    "model": "claude-sonnet-4-20250514",
                    "status": "active",
                    "created_at": (now - timedelta(minutes=30)).isoformat(),
                    "updated_at": now.isoformat(),
                },
                {
                    "id": "demo-session-003",
                    "title": "知识库 Obsidian 集成测试",
                    "source": "Web",
                    "model": "claude-sonnet-4-20250514",
                    "status": "completed",
                    "created_at": (now - timedelta(days=1)).isoformat(),
                    "updated_at": (now - timedelta(days=1)).isoformat(),
                },
            ],
            "messages": {
                "demo-session-001": [
                    {"role": "user", "content": "帮我初始化 Hermes Agent 的配置", "timestamp": (now - timedelta(hours=2)).isoformat()},
                    {"role": "assistant", "content": "好的，我来帮你初始化配置。首先检查当前环境...", "timestamp": (now - timedelta(hours=2, minutes=-1)).isoformat()},
                    {"role": "assistant", "content": "配置已完成：\n- 时区设置为 Asia/Shanghai\n- 持久化后端：Git\n- MCP 网关已启动", "timestamp": (now - timedelta(hours=1)).isoformat()},
                ],
                "demo-session-002": [
                    {"role": "user", "content": "扫描可用的 MCP 服务", "timestamp": (now - timedelta(minutes=30)).isoformat()},
                    {"role": "assistant", "content": "正在扫描 localhost 和 HF Space 网络中的 MCP 服务...", "timestamp": (now - timedelta(minutes=29)).isoformat()},
                ],
            },
        }
        sessions_file.write_text(json.dumps(sample_sessions, ensure_ascii=False, indent=2), encoding="utf-8")
        changed = True

    # 4. 日志数据（示例日志）
    log_file = home / "data" / "logs.json"
    if not log_file.exists():
        now = datetime.now()
        sample_logs = [
            {"timestamp": (now - timedelta(hours=3)).isoformat(), "level": "info", "source": "system", "message": "Hermes Agent 启动完成", "details": {"version": "6.0.0"}},
            {"timestamp": (now - timedelta(hours=2)).isoformat(), "level": "info", "source": "mcp", "message": "MCP 网关启动", "details": {"tools_count": 42}},
            {"timestamp": (now - timedelta(hours=1)).isoformat(), "level": "info", "source": "persistence", "message": "Git 自动备份完成", "details": {"files": 12}},
            {"timestamp": (now - timedelta(minutes=30)).isoformat(), "level": "info", "source": "api", "message": "MCP 服务扫描完成", "details": {"discovered": 3}},
            {"timestamp": now.isoformat(), "level": "info", "source": "system", "message": "系统运行正常", "details": {"uptime": "3h"}},
        ]
        log_file.write_text(json.dumps(sample_logs, ensure_ascii=False, indent=2), encoding="utf-8")
        changed = True

    # 5. 定时任务（示例）
    cron_file = home / "data" / "cron_jobs.json"
    if not cron_file.exists():
        sample_cron = [
            {
                "id": "cron-001",
                "name": "自动备份",
                "cron_expression": "0 */6 * * *",
                "message": "执行 Git 自动备份",
                "enabled": True,
                "last_run": (datetime.now() - timedelta(hours=4)).isoformat(),
                "next_run": (datetime.now() + timedelta(hours=2)).isoformat(),
            },
        ]
        cron_file.write_text(json.dumps(sample_cron, ensure_ascii=False, indent=2), encoding="utf-8")
        changed = True

    # 6. 学习记录（示例）
    learnings_file = home / "learnings.md"
    if not learnings_file.exists():
        learnings_file.write_text("""# Hermes Agent 学习记录

> 自动从对话和工具调用中提炼的经验和知识。

## API 调用最佳实践

- API.post() 只接受 2 个参数 (path, body)，需要 timeout 请用 API.request()
- 所有用户输入必须经过 Components.escapeHtml() 处理
- 使用 data-action 事件委托代替 inline onclick

## 前端开发规范

- 页面模块使用 IIFE 模式：const Page = (() => { ... return { render, onSSEEvent }; })();
- 图标使用 Components.icon(name, size) 统一管理
- Toast 通知使用 Components.Toast.success/error/info()
- Modal 确认使用 Components.Modal.confirm({ title, message, type })

## 部署注意事项

- HF Space 无持久化，数据需通过 Git 或 HF Buckets 同步
- app.py 需设置 GRADIO_SSR_MODE=false 和 TZ=Asia/Shanghai
- 前端资源通过 app.py inline 到 HTML 中
""", encoding="utf-8")
        changed = True

    # 7. 示例技能
    skills_dir = home / "skills"
    sample_skills = {
        "code-review": {
            "name": "code-review",
            "description": "代码审查与质量分析工具",
            "category": "开发工具",
            "tags": ["代码质量", "审查", "最佳实践"],
            "content": "# 代码审查\n\n## 描述\n对代码进行全面审查，检查代码质量、安全性和最佳实践。\n\n## 检查项\n- 代码风格一致性\n- 潜在安全漏洞\n- 性能优化建议\n- 错误处理完整性\n- 文档注释完整性",
            "created_at": (datetime.now() - timedelta(days=1)).isoformat(),
            "updated_at": datetime.now().isoformat(),
        },
        "data-sync": {
            "name": "data-sync",
            "description": "数据同步与备份管理",
            "category": "系统管理",
            "tags": ["同步", "备份", "Git"],
            "content": "# 数据同步\n\n## 描述\n管理 Hermes Agent 的数据持久化和同步策略。\n\n## 功能\n- Git 自动备份\n- HF Buckets 存储\n- 手动备份/恢复\n- 热更新支持",
            "created_at": (datetime.now() - timedelta(days=1)).isoformat(),
            "updated_at": datetime.now().isoformat(),
        },
    }
    for skill_name, skill_data in sample_skills.items():
        skill_file = skills_dir / f"{skill_name}.json"
        if not skill_file.exists():
            skill_file.write_text(json.dumps(skill_data, ensure_ascii=False, indent=2), encoding="utf-8")
            changed = True

    # 8. SOUL.md（Agent 人格定义）
    soul_file = home / "SOUL.md"
    if not soul_file.exists():
        soul_file.write_text("""# Hermes Agent 人格定义

## 身份
你是 Hermes，一个强大的 AI Agent 管理助手。

## 行为准则
1. 始终使用中文回复（技术术语可保留英文）
2. 提供简洁直接的回答，避免冗余解释
3. 遵循项目既有代码规范和模式
4. 操作前确认，重要变更需用户批准

## 能力
- MCP 工具调用和管理
- 会话记录和知识管理
- 代码审查和生成
- 数据分析和可视化
- 系统运维和监控
""", encoding="utf-8")
        changed = True

    return changed
