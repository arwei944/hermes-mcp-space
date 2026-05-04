# Hermes Agent MCP Space — 项目行为指令

> 本文件定义 AI Agent 在本项目中的行为规范，所有 Agent 必须遵守。
> 最后更新: 2026-05-04 | 版本: 15.2.0

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

### 2.0 文档输出格式规范

**默认输出格式为 Markdown (.md)**，仅在用户明确要求或内容需要高级格式时才使用 .docx。

| 场景 | 格式 | 说明 |
|------|------|------|
| 用户说"写一个文档/报告/总结" | **.md** | 默认 |
| 用户说"create a document" | **.md** | 默认 |
| 用户明确要求 .docx/.pptx/.xlsx | 对应格式 | 用户要求优先 |
| 内容需要修订跟踪(tracked changes) | .docx | 功能需要 |
| 内容需要复杂页面布局(页眉页脚等) | .docx | 功能需要 |
| 编辑已有的 .docx 文件 | .docx | 保持格式一致 |
| 向 .docx 添加批注 | .docx | 功能需要 |

Markdown 编写规范：
- 使用 GitHub Flavored Markdown (GFM)
- 中文内容无需特殊字体配置
- 文件保存到 `/workspace/` 作为最终交付物
- 无需外部依赖

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
- 版本号格式: `主版本.次版本.修订号` (如 15.2.0)
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
| `APP_VERSION` | 应用版本 | 15.2.0 |
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

### 6.7 build_full_html 全局变量冲突（⚠️ 高危）
**根因**：`build_full_html` 将所有 JS 内联到一个 `<script>` 标签，`const/let` 转为 `var`，不同目录的同名模块变量在全局作用域冲突，后定义的覆盖先定义的。

**症状**：
- 某个页面功能异常（如"X is not a function"、"Invalid selector [object HTMLDivElement]"）
- 控制台报错提到某个模块名

**预防规则**：
- **新增页面模块时，所有顶层变量必须加目录前缀**（如 `ops-center/OverviewTab.js` 中的变量用 `OpsOverviewTab`）
- **不要使用通用名称**（如 `OverviewTab`、`RulesTab`、`HistoryTab`），必须加目录特征前缀
- **构建时自动检测**：`_validate_build` 会扫描全局变量冲突并报告 warning

**已修复的冲突**：
- `OverviewTab` → ops-center 改为 `OpsOverviewTab`
- `RulesTab` → ops-alerts 改为 `OpsAlertsRulesTab`
- `TrendChart` → ops-dashboard 改为 `OpsTrendChart`

### 6.8 Changelog 注入失败
Docker 环境中无 `.git` 目录，changelog 需通过 `backend/data/changelog.py`（Python 模块）加载。
**注意**：`backend/data/__init__.py` 必须存在，否则包导入失败。

## 7. 会话初始化规范

### 7.1 每次新会话必须执行
```bash
git clone https://github.com/arwei944/hermes-mcp-space.git /data/user/work/repo
```
沙箱的 `/data/user/work` 每次会话重置为空，必须重新 clone。

### 7.2 文件交付规范
| 类型 | 路径 | 说明 |
|------|------|------|
| 最终交付物 | `/workspace/` | 用户可见，持久化 |
| 中间产物 | `/data/user/work/` | 临时，会话间重置 |
| 临时脚本 | `/data/user/work/` | 不要放 /workspace |

### 7.3 部署验证流程
1. `git push origin main` 后等待 ~3 分钟
2. 检查 `curl https://arwei944-hermes-mcp-space.hf.space/api/status`
3. 确认 `build_error` 为空
4. 前端 Ctrl+Shift+R 强刷验证

---

## 8. 🆕 对话上传规范（v15.2.0 新增）

### 8.1 自动捕获（后端保障）

Hermes MCP 中间件管道已集成 `ConversationCaptureMiddleware`，**所有 MCP 工具调用会自动捕获并写入 Hermes 会话**，无需 Agent 主动操作。

捕获内容包括：
- 工具名称
- 调用参数（截取前 300 字符）
- 返回结果（截取前 500 字符）
- 执行耗时
- 错误信息（如有）

### 8.2 主动上传（Prompt 保障）

除自动捕获外，Agent 在以下场景应**主动上传对话摘要**：

1. **完成一个完整任务后**：调用 `log_conversation` 记录任务摘要
2. **用户明确要求时**：调用 `create_session` + `add_message` 记录完整对话
3. **发现重要信息时**：调用 `memory_create` 或 `knowledge_create` 记录

### 8.3 上传格式

```python
# 对话摘要上传
log_conversation(
    role="assistant",
    content="## 任务摘要\n完成了 XXX 任务\n\n## 关键步骤\n1. ...\n2. ...\n\n## 结论\n..."
)

# 完整对话上传
create_session(title="任务描述")
add_message(session_id="sess_xxx", role="user", content="用户原始输入")
add_message(session_id="sess_xxx", role="assistant", content="完整回复（含思考过程）")
```

---

## 9. 🆕 行为约束规范（v15.2.0 新增）

### 9.1 工具调用规范

1. **写操作前确认**：调用 `create`/`update`/`delete` 类工具前，必须先确认用户意图
2. **连续失败停止**：同一工具连续失败 3 次必须停止重试并报告用户
3. **删除操作二次确认**：涉及数据删除的操作（`delete_session`、`memory_forget`、`knowledge_delete`）必须二次确认
4. **规则遵守**：遵守所有 `scope='tool_guard'` 的活跃规则（由中间件自动执行）

### 9.2 输出规范

1. **默认 Markdown**：所有输出使用 Markdown 格式
2. **数据对比用表格**：涉及版本对比、数据对比时必须使用表格
3. **操作结果三要素**：状态 + 详情 + 后续建议
4. **错误友好提示**：用通俗语言解释错误，附带解决建议

### 9.3 不确定时主动询问

以下场景必须使用 AskUserQuestion 工具主动询问：
- 用户指令有歧义
- 存在多种实现方案
- 操作可能造成不可逆影响
- 缺少关键决策信息
