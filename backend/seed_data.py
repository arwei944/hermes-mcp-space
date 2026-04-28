# -*- coding: utf-8 -*-
"""Hermes Agent - 种子数据初始化

HF Space 首次启动时自动生成演示数据，让所有页面都有内容展示。
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict


def get_hermes_home() -> Path:
    home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    return Path(home)


def init_seed_data():
    """初始化种子数据（仅在数据不存在时创建）"""
    home = get_hermes_home()
    changed = False

    # 1. 记忆文件
    memories_dir = home / "memories"
    memories_dir.mkdir(parents=True, exist_ok=True)

    memory_file = memories_dir / "MEMORY.md"
    if not memory_file.exists():
        memory_file.write_text("""# Agent 长期记忆

## 用户偏好
- 用户喜欢简洁高效的回复
- 主要使用中文交流
- 偏好 Mac 极简设计风格

## 项目上下文
- 当前项目: Hermes Agent MCP Space
- 部署平台: HuggingFace Spaces
- MCP 端点: /mcp (Streamable HTTP)
- 管理面板: / (Web UI)

## 重要记录
- 2026-04-28: 项目初始化，完成基础框架搭建
- 2026-04-28: MCP 工具从 10 个扩展到 16 个
- 2026-04-28: 添加深色模式支持
- 2026-04-28: 数据可视化（5 种 SVG 图表）
- 2026-04-28: SSE 实时推送 + 操作日志
- 2026-04-28: 数据真实化（JSON 持久化）
""", encoding="utf-8")
        changed = True

    user_file = memories_dir / "USER.md"
    if not user_file.exists():
        user_file.write_text("""# 用户画像

## 基本信息
- 开发者，熟悉 Python、JavaScript、TypeScript
- 使用 Trae / Claude Desktop 作为主要 IDE
- 活跃在 HuggingFace 和 GitHub 社区

## 技术栈
- 后端: Python, FastAPI, Gradio
- 前端: 原生 JS, CSS (Mac 极简风格)
- 部署: HF Spaces, GitHub Actions CI/CD
- 协议: MCP (Model Context Protocol)

## 偏好
- 喜欢全栈开发，从后端到前端一手包办
- 注重代码质量和测试覆盖率
- 偏好轻量级方案（零依赖图表、单文件内联）
""", encoding="utf-8")
        changed = True

    # 2. 技能文件
    skills_dir = home / "skills"
    skills_dir.mkdir(parents=True, exist_ok=True)

    skills = {
        "code-review": """# 代码审查

## 描述
对代码进行系统性审查，检查潜在问题。

## 使用方法
1. 获取需要审查的代码
2. 检查代码风格、逻辑错误、安全漏洞
3. 提供改进建议

## 检查清单
- [ ] 代码风格一致性
- [ ] 错误处理是否完善
- [ ] 是否有安全漏洞
- [ ] 性能是否可优化
- [ ] 注释是否充分
""",
        "api-design": """# API 设计

## 描述
设计 RESTful API 接口，遵循最佳实践。

## 原则
- RESTful 命名规范
- 统一的错误响应格式
- 版本管理策略
- 适当的 HTTP 状态码

## 响应格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```
""",
        "deployment": """# 部署管理

## 描述
管理项目的部署流程和 CI/CD 配置。

## 支持的平台
- HuggingFace Spaces (Gradio SDK)
- GitHub Pages
- Docker 容器

## 部署检查清单
- [ ] 环境变量已配置
- [ ] 依赖版本已锁定
- [ ] 健康检查端点可用
- [ ] 日志输出正常
""",
        "data-analysis": """# 数据分析

## 描述
对数据进行统计分析和可视化。

## 能力
- 数据清洗和预处理
- 统计分析（均值、中位数、分布）
- 趋势分析
- 异常检测

## 输出格式
- Markdown 表格
- SVG 图表（柱状图、折线图、饼图）
- JSON 结构化数据
""",
    }

    for name, content in skills.items():
        skill_file = skills_dir / f"{name}.md"
        if not skill_file.exists():
            skill_file.write_text(content, encoding="utf-8")
            changed = True

    # 3. 会话数据
    data_dir = home / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    sessions_file = data_dir / "sessions.json"
    if not sessions_file.exists():
        now = datetime.now()
        sessions_data = {
            "sessions": [
                {
                    "id": "sess_20260428_001",
                    "title": "项目初始化讨论",
                    "model": "claude-4-sonnet",
                    "source": "Trae",
                    "created_at": (now - timedelta(hours=48)).isoformat(),
                    "updated_at": (now - timedelta(hours=48)).isoformat(),
                    "status": "completed",
                },
                {
                    "id": "sess_20260428_002",
                    "title": "MCP 工具开发",
                    "model": "qwen3-coder",
                    "source": "Trae",
                    "created_at": (now - timedelta(hours=36)).isoformat(),
                    "updated_at": (now - timedelta(hours=24)).isoformat(),
                    "status": "completed",
                },
                {
                    "id": "sess_20260428_003",
                    "title": "前端页面开发",
                    "model": "claude-4-sonnet",
                    "source": "Trae",
                    "created_at": (now - timedelta(hours=24)).isoformat(),
                    "updated_at": (now - timedelta(hours=12)).isoformat(),
                    "status": "completed",
                },
                {
                    "id": "sess_20260428_004",
                    "title": "深色模式实现",
                    "model": "gpt-4o",
                    "source": "Web",
                    "created_at": (now - timedelta(hours=12)).isoformat(),
                    "updated_at": (now - timedelta(hours=6)).isoformat(),
                    "status": "completed",
                },
                {
                    "id": "sess_20260428_005",
                    "title": "数据可视化图表",
                    "model": "claude-4-sonnet",
                    "source": "Trae",
                    "created_at": (now - timedelta(hours=6)).isoformat(),
                    "updated_at": (now - timedelta(hours=2)).isoformat(),
                    "status": "active",
                },
                {
                    "id": "sess_20260428_006",
                    "title": "SSE 实时推送开发",
                    "model": "qwen3-coder",
                    "source": "Trae",
                    "created_at": (now - timedelta(hours=2)).isoformat(),
                    "updated_at": now.isoformat(),
                    "status": "active",
                },
            ],
            "messages": {
                "sess_20260428_005": [
                    {"role": "user", "content": "帮我实现仪表盘的数据可视化", "timestamp": (now - timedelta(hours=6)).isoformat()},
                    {"role": "assistant", "content": "好的，我来实现 5 种 SVG 图表：\n\n1. **环形图** - 会话来源分布\n2. **柱状图** - 模型使用频率\n3. **折线图** - 7 天会话趋势\n4. **仪表盘** - 系统资源监控\n5. **面积图** - 活跃度趋势\n\n全部使用纯 SVG 实现，零外部依赖。", "timestamp": (now - timedelta(hours=6)).isoformat()},
                    {"role": "user", "content": "很好，确保深色模式下也能正常显示", "timestamp": (now - timedelta(hours=5)).isoformat()},
                    {"role": "assistant", "content": "已使用 CSS 变量 `var(--accent)` 等确保深色模式兼容。图表颜色会自动跟随主题切换。", "timestamp": (now - timedelta(hours=5)).isoformat()},
                ],
                "sess_20260428_006": [
                    {"role": "user", "content": "实现 SSE 实时推送功能", "timestamp": (now - timedelta(hours=2)).isoformat()},
                    {"role": "assistant", "content": "SSE 实时推送方案：\n\n**后端**：\n- `GET /api/events` - SSE 事件流\n- `EventEmitMiddleware` - 拦截写操作自动发射事件\n- 支持 12 种事件类型\n\n**前端**：\n- `EventSource` 监听\n- Toast 通知\n- 仪表盘/日志自动刷新", "timestamp": (now - timedelta(hours=2)).isoformat()},
                    {"role": "user", "content": "同时记录操作日志", "timestamp": (now - timedelta(hours=1)).isoformat()},
                    {"role": "assistant", "content": "已在中间件中集成操作日志记录。所有 PUT/POST/DELETE 操作自动写入日志，支持按级别和来源过滤。", "timestamp": (now - timedelta(hours=1)).isoformat()},
                ],
            },
        }
        sessions_file.write_text(json.dumps(sessions_data, ensure_ascii=False, indent=2), encoding="utf-8")
        changed = True

    # 4. 定时任务数据
    cron_file = data_dir / "cron_jobs.json"
    if not cron_file.exists():
        cron_data = [
            {
                "id": "cron_001",
                "name": "日报生成",
                "schedule": "0 9 * * *",
                "command": "生成每日工作报告，总结昨天的会话和操作",
                "status": "active",
                "description": "每天早上 9 点自动生成日报",
                "created_at": (datetime.now() - timedelta(days=7)).isoformat(),
                "last_run": (datetime.now() - timedelta(hours=12)).isoformat(),
            },
            {
                "id": "cron_002",
                "name": "缓存清理",
                "schedule": "0 3 * * 0",
                "command": "清理超过 30 天的过期会话和临时文件",
                "status": "active",
                "description": "每周日凌晨 3 点清理缓存",
                "created_at": (datetime.now() - timedelta(days=7)).isoformat(),
                "last_run": (datetime.now() - timedelta(days=3)).isoformat(),
            },
            {
                "id": "cron_003",
                "name": "健康检查",
                "schedule": "*/30 * * * *",
                "command": "检查所有 API 端点和 MCP 服务的可用性",
                "status": "active",
                "description": "每 30 分钟检查一次系统健康状态",
                "created_at": (datetime.now() - timedelta(days=5)).isoformat(),
                "last_run": (datetime.now() - timedelta(minutes=15)).isoformat(),
            },
            {
                "id": "cron_004",
                "name": "数据备份",
                "schedule": "0 2 * * *",
                "command": "备份会话数据和记忆文件到 backup 目录",
                "status": "paused",
                "description": "每天凌晨 2 点备份数据（已暂停）",
                "created_at": (datetime.now() - timedelta(days=3)).isoformat(),
                "last_run": None,
            },
        ]
        cron_file.write_text(json.dumps(cron_data, ensure_ascii=False, indent=2), encoding="utf-8")
        changed = True

    # 5. 操作日志
    log_file = data_dir / "logs.json"
    if not log_file.exists():
        now = datetime.now()
        seed_logs = [
            {"id": "log-seed-001", "timestamp": (now - timedelta(hours=48)).isoformat(), "action": "系统启动", "target": "Hermes Agent", "detail": "HF Space 首次启动，种子数据初始化", "level": "success", "source": "system"},
            {"id": "log-seed-002", "timestamp": (now - timedelta(hours=48)).isoformat(), "action": "创建技能", "target": "code-review", "detail": "种子数据: 代码审查技能", "level": "success", "source": "system"},
            {"id": "log-seed-003", "timestamp": (now - timedelta(hours=48)).isoformat(), "action": "创建技能", "target": "api-design", "detail": "种子数据: API 设计技能", "level": "success", "source": "system"},
            {"id": "log-seed-004", "timestamp": (now - timedelta(hours=48)).isoformat(), "action": "创建技能", "target": "deployment", "detail": "种子数据: 部署管理技能", "level": "success", "source": "system"},
            {"id": "log-seed-005", "timestamp": (now - timedelta(hours=48)).isoformat(), "action": "创建技能", "target": "data-analysis", "detail": "种子数据: 数据分析技能", "level": "success", "source": "system"},
            {"id": "log-seed-006", "timestamp": (now - timedelta(hours=36)).isoformat(), "action": "创建会话", "target": "sess_20260428_001", "detail": "项目初始化讨论", "level": "info", "source": "user"},
            {"id": "log-seed-007", "timestamp": (now - timedelta(hours=36)).isoformat(), "action": "MCP 调用: write_memory", "target": "MEMORY.md", "detail": "写入项目上下文和用户偏好", "level": "success", "source": "mcp"},
            {"id": "log-seed-008", "timestamp": (now - timedelta(hours=24)).isoformat(), "action": "创建会话", "target": "sess_20260428_003", "detail": "前端页面开发", "level": "info", "source": "user"},
            {"id": "log-seed-009", "timestamp": (now - timedelta(hours=24)).isoformat(), "action": "MCP 调用: create_skill", "target": "code-review", "detail": "通过 MCP 创建代码审查技能", "level": "success", "source": "mcp"},
            {"id": "log-seed-010", "timestamp": (now - timedelta(hours=12)).isoformat(), "action": "更新配置", "target": "config.yaml", "detail": "更新日志级别为 INFO", "level": "info", "source": "user"},
            {"id": "log-seed-011", "timestamp": (now - timedelta(hours=6)).isoformat(), "action": "MCP 调用: list_sessions", "target": "sessions", "detail": "查询最近 5 个会话", "level": "info", "source": "mcp"},
            {"id": "log-seed-012", "timestamp": (now - timedelta(hours=6)).isoformat(), "action": "MCP 调用: read_memory", "target": "MEMORY.md", "detail": "读取 Agent 长期记忆", "level": "success", "source": "mcp"},
            {"id": "log-seed-013", "timestamp": (now - timedelta(hours=2)).isoformat(), "action": "MCP 调用: get_dashboard_summary", "target": "dashboard", "detail": "获取仪表盘摘要数据", "level": "info", "source": "mcp"},
            {"id": "log-seed-014", "timestamp": (now - timedelta(hours=1)).isoformat(), "action": "MCP 调用: update_skill", "target": "code-review", "detail": "更新代码审查技能内容", "level": "success", "source": "mcp"},
            {"id": "log-seed-015", "timestamp": (now - timedelta(minutes=30)).isoformat(), "action": "创建定时任务", "target": "cron_003", "detail": "健康检查: 每 30 分钟检查系统状态", "level": "success", "source": "user"},
            {"id": "log-seed-016", "timestamp": (now - timedelta(minutes=15)).isoformat(), "action": "触发定时任务", "target": "cron_003", "detail": "健康检查: 所有端点正常", "level": "success", "source": "cron"},
            {"id": "log-seed-017", "timestamp": (now - timedelta(minutes=5)).isoformat(), "action": "MCP 调用: get_logs", "target": "logs", "detail": "查询最近 10 条操作日志", "level": "info", "source": "mcp"},
            {"id": "log-seed-018", "timestamp": (now - timedelta(minutes=1)).isoformat(), "action": "系统启动", "target": "Hermes Agent", "detail": "服务启动完成，MCP 端点就绪", "level": "success", "source": "system"},
        ]
        log_file.write_text(json.dumps(seed_logs, ensure_ascii=False, indent=2), encoding="utf-8")
        changed = True

    return changed
