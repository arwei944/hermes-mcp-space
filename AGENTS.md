# Hermes Agent MCP Space — 项目行为指令

> 本文件定义 AI Agent 在本项目中的行为规范，所有 Agent 必须遵守。

## 1. 项目概述

Hermes Agent MCP Space 是一个 AI Agent 管理面板 + MCP 服务的综合平台，部署在 HuggingFace Spaces。

- **技术栈**: Python (FastAPI + Gradio) 后端 + 原生 JavaScript 前端
- **部署**: HuggingFace Spaces (arwei944/hermes-mcp-space)
- **协议**: MCP (Model Context Protocol) 2025-03-26

## 2. 核心行为规范

### 2.1 代码风格
- 后端: Python 3.10+, FastAPI, 中文 docstring
- 前端: 原生 JavaScript (IIFE 模式), 禁止 ES6 modules (import/export)
- 事件处理: 统一使用 `data-action` + 事件委托, 禁止 `onclick` 内联
- UI 组件: 统一使用 `Components.xxx()` 方法
- API 调用: 统一使用 `API.get/post/put/del` 方法

### 2.2 API 开发规范
- 新端点必须放在 `/{dynamic_id}` 路由之前（FastAPI 路由顺序匹配）
- 时间格式: ISO 8601 (UTC+8)
- 错误格式: `{ success: bool, error?: string, data?: any }`
- 所有列表 API 支持 `page` + `page_size` 分页
- 数据源优先调用 Hermes MCP 工具

### 2.3 前端开发规范
- 模块模式: `const XxxPage = (() => { ... return { render, onSSEEvent }; })();`
- SSE 消费: `onSSEEvent(type, data)` + 500ms 防抖
- XSS 防护: `Components.escapeHtml()` 处理所有用户数据
- 所有文本使用中文

### 2.4 版本管理
- 版本号格式: `主版本.次版本.修订号` (如 6.5.0)
- 版本号在 `backend/version.py` 中管理
- 每次功能更新必须递增版本号

## 3. 项目结构

```
hermes-mcp-space/
├── app.py                    # 应用入口 (Gradio + FastAPI)
├── backend/
│   ├── routers/              # API 路由
│   │   ├── sessions.py       # 会话管理 (v6.2.0-v6.5.0 增强)
│   │   ├── mcp.py            # MCP 服务管理
│   │   ├── skills.py         # 技能管理
│   │   ├── memory.py         # 记忆管理
│   │   ├── knowledge.py      # 知识库
│   │   ├── config_api.py     # 配置管理
│   │   ├── cron.py           # 定时任务
│   │   ├── events.py         # SSE 事件
│   │   ├── dashboard.py      # 仪表盘
│   │   ├── plugins.py        # 插件管理
│   │   └── ...
│   ├── services/
│   │   ├── hermes_service.py # 主服务层
│   │   └── mcp_client_service.py  # MCP 客户端服务
│   ├── middleware/
│   │   └── events.py         # SSE 事件中间件
│   ├── mcp_server.py         # MCP 协议实现
│   ├── config.py             # 配置管理
│   └── version.py            # 版本号
├── frontend/
│   └── js/
│       ├── app.js            # 前端入口 + SSE
│       ├── api.js            # API 封装
│       ├── components.js     # UI 组件库
│       └── pages/            # 页面模块
├── AGENTS.md                 # 本文件
└── Hermes_Session_Module_Refactor_Plan.md  # 会话模块重构方案
```

## 4. MCP 外部服务器管理

### 4.1 添加外部服务器
- 通过 `POST /api/mcp/servers` 添加
- 自动发现工具并注册到工具列表
- 配置持久化到 `~/.hermes/mcp_servers.json`

### 4.2 已注册的外部服务器
- `proxy-mcp`: https://arwei944-proxy-mcp.hf.space/mcp (MCP 代理网关)

### 4.3 扫描发现
- 支持本地端口扫描 (3000-3005, 4000, 5000, 8000, 8080)
- 支持同用户 HF Space 扫描
- 支持 HF Space URL 直接输入 (自动转换格式)
- 支持 MCP 端点路径探测 (/mcp, /sse, /api/mcp)
- HF Space 冷启动超时: 15 秒

## 5. 数据持久化

- 主存储: `~/.hermes/` 目录
- 会话数据: `~/.hermes/data/sessions.json`
- 外部服务器: `~/.hermes/mcp_servers.json`
- 记忆: `~/.hermes/memories/MEMORY.md`
- 用户画像: `~/.hermes/memories/USER.md`
- 支持后端: git / hf_buckets / none
