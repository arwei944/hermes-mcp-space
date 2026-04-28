---
title: Hermes Agent MCP Space
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: "5.49.1"
python_version: "3.11"
app_file: app.py
pinned: false
---

# Hermes Agent MCP Space

> **GitHub**: [arwei944/hermes-mcp-space](https://github.com/arwei944/hermes-mcp-space) | **HF Spaces**: [arwei944/hermes-mcp-space](https://huggingface.co/spaces/arwei944/hermes-mcp-space)

Hermes Agent 的 MCP（Model Context Protocol）集成服务 + Web 管理面板。部署在 HF Spaces，供 Trae、Claude Desktop、Cursor 等 MCP 客户端连接使用。

## 功能概览

### MCP 工具（16 个）

| 类别 | 工具 | 说明 |
|------|------|------|
| **会话** | `list_sessions` | 列出最近会话 |
| | `search_sessions` | 按关键词搜索会话 |
| | `get_session_messages` | 获取会话消息历史 |
| | `delete_session` | 删除会话 |
| **工具** | `list_tools` | 列出所有可用工具 |
| **技能** | `list_skills` | 列出所有技能 |
| | `get_skill_content` | 获取技能详细内容 |
| | `create_skill` | 创建新技能 |
| **记忆** | `read_memory` | 读取 Agent 长期记忆 |
| | `read_user_profile` | 读取用户画像 |
| | `write_memory` | 写入/更新记忆 |
| | `write_user_profile` | 写入/更新用户画像 |
| **定时任务** | `list_cron_jobs` | 列出定时任务 |
| | `create_cron_job` | 创建定时任务 |
| **系统** | `get_system_status` | 获取系统状态 |
| | `get_dashboard_summary` | 获取仪表盘摘要 |

### Web 管理面板（12 个页面）

| 页面 | 功能 |
|------|------|
| 仪表盘 | 统计卡片 + 5 种 SVG 图表（环形图/柱状图/折线图/仪表盘） |
| 会话管理 | 会话列表、搜索、删除 |
| 会话对话 | 左右分栏，查看消息详情，支持搜索 |
| 工具管理 | 工具列表、启用/禁用切换 |
| 技能系统 | 在线编辑器 + Markdown 实时预览 + 模板插入 |
| 记忆管理 | MEMORY.md / USER.md 编辑器，实时预览 |
| 定时任务 | 完整 CRUD + 手动触发 + 弹窗表单 |
| 子 Agent | Agent 列表、状态监控、终止 |
| MCP 服务 | 状态监控、工具列表、Trae 配置一键复制 |
| 操作日志 | 所有 API 操作记录，按级别/来源过滤 |
| 系统配置 | 温度、日志级别等配置项 |
| API 文档 | Swagger UI（/docs）+ ReDoc（/redoc） |

### 其他特性

- **深色模式** — 自动跟随系统，手动切换，localStorage 持久化
- **SSE 实时推送** — 写操作自动通知，仪表盘/日志自动刷新
- **数据持久化** — 会话/记忆/技能/配置全部真实文件存储
- **API 文档** — 自动生成 OpenAPI 3.0，99+ 端点
- **CI/CD** — GitHub push → 自动部署到 HF Spaces

## 快速开始

### 1. Trae 接入 MCP

打开 Trae → 设置 → MCP → 添加配置：

```json
{
  "mcpServers": {
    "hermes": {
      "url": "https://arwei944-hermes-mcp-space.hf.space/mcp"
    }
  }
}
```

连接后即可在 Trae 中调用 16 个 Hermes 工具。

### 2. Claude Desktop 接入

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "hermes": {
      "url": "https://arwei944-hermes-mcp-space.hf.space/mcp"
    }
  }
}
```

### 3. 访问管理面板

打开 https://arwei944-hermes-mcp-space.hf.space 即可查看 Web 管理面板。

## 本地开发

```bash
# 克隆项目
git clone https://github.com/arwei944/hermes-mcp-space.git
cd hermes-mcp-space

# 安装依赖
pip install -r requirements.txt

# 启动服务（Gradio + API + MCP）
python app.py
```

访问 http://localhost:7860 查看管理面板。

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `HERMES_API_URL` | 空 | 远程 Hermes API 地址（配置后使用真实数据） |
| `APP_VERSION` | `2.0.0` | 应用版本号 |
| `HERMES_HOME` | `~/.hermes` | 数据存储目录 |

## 项目结构

```
hermes-mcp-space/
├── app.py                      # 入口（Gradio + FastAPI + MCP）
├── mcp_server.py               # MCP 服务（Streamable HTTP + SSE）
├── requirements.txt            # Python 依赖
├── .github/workflows/
│   └── deploy-hf.yml           # GitHub → HF Spaces 自动部署
├── backend/
│   ├── config.py               # 配置管理
│   ├── middleware/
│   │   └── events.py           # SSE 事件 + 操作日志中间件
│   ├── routers/
│   │   ├── sessions.py         # 会话 API
│   │   ├── tools.py            # 工具 API
│   │   ├── skills.py           # 技能 API
│   │   ├── memory.py           # 记忆 API
│   │   ├── cron.py             # 定时任务 API
│   │   ├── agents.py           # 子 Agent API
│   │   ├── mcp.py              # MCP 状态 API
│   │   ├── config_api.py       # 配置 API
│   │   ├── dashboard.py        # 仪表盘 API
│   │   ├── events.py           # SSE 事件流
│   │   └── logs.py             # 操作日志 API
│   └── services/
│       └── hermes_service.py   # 核心业务逻辑
└── frontend/
    ├── index.html              # 主页面
    ├── css/style.css           # 样式（含深色模式）
    └── js/
        ├── api.js              # API 封装
        ├── components.js       # 公共组件
        ├── app.js              # 路由 + SSE 监听 + 主题
        └── pages/
            ├── dashboard.js    # 仪表盘（含 SVG 图表）
            ├── sessions.js     # 会话管理
            ├── chat.js         # 会话对话
            ├── tools.js        # 工具管理
            ├── skills.js       # 技能编辑器
            ├── memory.js       # 记忆管理
            ├── cron.js         # 定时任务
            ├── agents.js       # 子 Agent
            ├── mcp.js          # MCP 服务
            ├── logs.js         # 操作日志
            └── config.js       # 系统配置
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/status` | 系统状态 |
| GET | `/api/dashboard` | 仪表盘数据 |
| GET/POST | `/api/sessions` | 会话列表/创建 |
| GET/DELETE | `/api/sessions/{id}` | 会话详情/删除 |
| GET | `/api/sessions/{id}/messages` | 会话消息 |
| GET | `/api/tools` | 工具列表 |
| GET | `/api/toolsets` | 工具集列表 |
| PUT | `/api/tools/{name}` | 切换工具状态 |
| GET/POST | `/api/skills` | 技能列表/创建 |
| PUT/DELETE | `/api/skills/{name}` | 更新/删除技能 |
| GET/PUT | `/api/memory` | 读取/更新记忆 |
| GET/POST | `/api/cron/jobs` | 定时任务列表/创建 |
| PUT/DELETE | `/api/cron/jobs/{id}` | 更新/删除任务 |
| POST | `/api/cron/jobs/{id}/trigger` | 手动触发任务 |
| GET | `/api/agents` | Agent 列表 |
| DELETE | `/api/agents/{id}` | 终止 Agent |
| GET | `/api/mcp` | MCP 状态 |
| GET/PUT | `/api/config` | 读取/更新配置 |
| POST | `/api/config/reset` | 重置配置 |
| GET/DELETE | `/api/logs` | 操作日志 |
| GET | `/api/logs/stats` | 日志统计 |
| GET | `/api/events` | SSE 事件流 |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc |
| POST | `/mcp` | MCP Streamable HTTP |

## 数据存储

所有数据存储在 HF Spaces 持久化目录中：

```
~/.hermes/
├── data/
│   ├── sessions.json      # 会话数据（JSON 持久化）
│   ├── cron_jobs.json     # 定时任务
│   └── sessions.db        # SQLite（如果本地有 Hermes）
├── memories/
│   ├── MEMORY.md          # Agent 长期记忆
│   └── USER.md            # 用户画像
├── skills/                # 技能文件
│   └── {skill_name}.md
└── config.yaml            # 系统配置
```

## 许可证

MIT License
