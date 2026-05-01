# Hermes Agent MCP Space — 项目行为指令

> 本文件定义 AI Agent 在本项目中的行为规范，所有 Agent 必须遵守。
> 最后更新: 2026-05-01 | 版本: 7.0.0

---

## 0. ⚠️ 网络访问规范（最高优先级）

### 0.1 沙箱网络限制

本项目的 AI Agent 运行在远程沙箱环境中，存在以下网络限制：
- ❌ **无法直接访问** Google、YouTube、Twitter/X、Facebook 等境外网站
- ❌ **无法直接使用** curl/wget 访问被限制的域名
- ✅ **可以访问** GitHub、HuggingFace、PyPI、NPM 等开发资源

### 0.2 外部访问必须通过 MCP 代理服务

**所有需要访问外部网络的操作，必须通过 proxy-mcp 代理服务执行，严禁直连。**

已注册代理服务器：
- **proxy-mcp**: `https://arwei944-proxy-mcp.hf.space/mcp`

可用代理工具：

| 工具名 | 用途 | 示例 |
|--------|------|------|
| `mcp_proxy-mcp_proxy_fetch` | 抓取网页内容 | 访问 Google、任意 URL |
| `mcp_proxy-mcp_proxy_search` | DuckDuckGo 搜索 | 搜索关键词、查资料 |
| `mcp_proxy-mcp_proxy_request` | 通用 HTTP 代理请求 | 发送任意 HTTP 请求 |

### 0.3 代理使用规范

```
# ✅ 正确：通过 MCP 代理访问外部网站
tools/call → mcp_proxy-mcp_proxy_fetch → {"url": "https://www.google.com"}
tools/call → mcp_proxy-mcp_proxy_search → {"query": "搜索内容", "max_results": 5}
tools/call → mcp_proxy-mcp_proxy_request → {"url": "https://api.example.com", "method": "GET"}

# ❌ 错误：直接 curl 访问外部网站
curl https://www.google.com          # 会超时失败
curl https://twitter.com            # 会超时失败
```

### 0.4 代理服务恢复

HF Space 重启后 proxy-mcp 配置会丢失，需要重新注册：
```bash
curl -X POST "https://arwei944-hermes-mcp-space.hf.space/api/mcp/servers?name=proxy-mcp&url=https://arwei944-proxy-mcp.hf.space/mcp"
```

---

## 1. 项目概述

Hermes Agent MCP Space 是一个 AI Agent 管理面板 + MCP 服务的综合平台，部署在 HuggingFace Spaces。

- **技术栈**: Python (FastAPI + Gradio) 后端 + 原生 JavaScript 前端
- **部署**: HuggingFace Spaces (arwei944/hermes-mcp-space)
- **协议**: MCP (Model Context Protocol) 2025-03-26
- **仓库**: https://github.com/arwei944/hermes-mcp-space

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
- 版本号格式: `主版本.次版本.修订号` (如 7.0.0)
- 版本号在 `backend/version.py` 中管理
- 每次功能更新必须递增版本号

## 3. MCP 外部服务器管理

### 3.1 添加外部服务器
- 通过 `POST /api/mcp/servers` 添加
- 自动发现工具并注册到工具列表
- 配置持久化到 `~/.hermes/mcp_servers.json`

### 3.2 已注册的外部服务器
- **proxy-mcp**: `https://arwei944-proxy-mcp.hf.space/mcp` (MCP 代理网关)
  - 工具: proxy_fetch, proxy_search, proxy_request, proxy_health
  - 用途: 绕过沙箱网络限制，访问外部网站

### 3.3 扫描发现
- 支持本地端口扫描 (3000-3005, 4000, 5000, 8000, 8080)
- 支持同用户 HF Space 扫描
- 支持 HF Space URL 直接输入 (自动转换格式)
- 支持 MCP 端点路径探测 (/mcp, /sse, /api/mcp)
- HF Space 冷启动超时: 15 秒

## 4. 数据持久化

- 主存储: `~/.hermes/` 目录
- 会话数据: `~/.hermes/data/sessions.json`
- 外部服务器: `~/.hermes/mcp_servers.json`
- 记忆: `~/.hermes/memories/MEMORY.md`
- 用户画像: `~/.hermes/memories/USER.md`
- 备份: `~/.hermes/backups/`
- 支持后端: git / hf_buckets / none

## 5. 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `APP_VERSION` | 应用版本 | 7.0.0 |
| `AUTH_TOKEN` | API 认证 token（空=关闭） | "" |
| `RATE_LIMIT_ENABLED` | 速率限制开关 | false |
| `RATE_LIMIT_PER_MINUTE` | 每分钟请求数 | 60 |
| `CACHE_ENABLED` | 响应缓存开关 | false |
| `CACHE_TTL` | 缓存过期时间(秒) | 60 |

## 6. 关键踩坑记录

### 6.1 FastAPI 路由顺序
静态路由（如 `/export`, `/search`）必须在 `/{session_id}` 之前注册，否则会被动态路由捕获返回 404。

### 6.2 HF Space 冷启动
MCP 发现超时需设为 15 秒，同时探测 `/mcp`、`/sse`、`/api/mcp` 三种路径。

### 6.3 路由未注册
新增路由模块后必须在 `main.py` 中 `include_router`，否则端点返回 404。

### 6.4 健康检查覆盖
`app.py` 中的 `/api/health` 会覆盖 `main.py` 的版本，修改时需同时改两处。

### 6.5 中文 URL 编码
搜索端点需添加 `urllib.parse.unquote()` 容错处理中文参数。

### 6.6 外部服务器丢失
HF Space 重启后外部 MCP 服务器配置丢失，需重新通过 API 注册。
