# Hermes MCP Space — 交接文档

> 最后更新: 2026-04-28 | 当前版本: v3.1.0

---

## 一、项目概览

| 项 | 值 |
|---|---|
| **项目名** | Hermes MCP Space |
| **定位** | IDE 的 MCP 工具服务端 + 管理面板 |
| **仓库** | https://github.com/arwei944/hermes-mcp-space |
| **部署** | HuggingFace Spaces (Gradio) |
| **在线地址** | https://arwei944-hermes-mcp-space.hf.space |
| **技术栈** | Python 3 + FastAPI + Gradio + 原生 JS + SQLite |
| **当前版本** | v3.0.0 |
| **MCP 工具数** | 44 个内置 + 外部无限 |
| **前端页面** | 13 个 |
| **API 端点** | 120+ |

### 核心定位

**不是**一个独立的 AI Agent，而是 **IDE 的 MCP 工具服务端**。LLM 和 Agent Loop 由 IDE（Trae / Claude Desktop / VS Code Copilot / Cursor）提供，我们通过 MCP 协议为 IDE 提供工具能力。

```
IDE (Trae/Claude/Cursor)
    ↓ 单一 MCP 连接
Hermes MCP Space（网关）
    ├── 本地工具（44个）
    ├── 外部 MCP 服务器 A → mcp_a_xxx
    └── 外部 MCP 服务器 B → mcp_b_xxx
```

---

## 二、目录结构

```
hermes-mcp-space/
├── app.py                          # Gradio 入口 + 路由注入 + 前端 HTML 内联构建
├── backend/
│   ├── main.py                     # FastAPI 应用 + 路由注册
│   ├── config.py                   # 配置管理（YAML + 环境变量）
│   ├── mcp_server.py               # MCP 协议服务端（44 个工具定义 + 调度）
│   ├── seed_data.py                # 首次启动种子数据
│   ├── routers/                    # API 路由（13 个模块）
│   │   ├── sessions.py             # 会话 CRUD
│   │   ├── tools.py                # 工具管理
│   │   ├── skills.py               # 技能 CRUD
│   │   ├── memory.py               # 记忆读写
│   │   ├── cron.py                 # 定时任务 CRUD
│   │   ├── agents.py               # 子 Agent 管理
│   │   ├── config_api.py           # 系统配置
│   │   ├── mcp.py                  # MCP 状态 + 外部服务器管理 API
│   │   ├── dashboard.py            # 仪表盘统计
│   │   ├── logs.py                 # 操作日志
│   │   ├── events.py               # SSE 实时事件
│   │   ├── plugins.py              # 插件市场
│   │   └── trash.py                # 回收站
│   └── services/                   # 业务逻辑（6 个模块）
│       ├── hermes_service.py       # 核心服务（会话/技能/记忆/定时任务/日志）
│       ├── mcp_client_service.py   # MCP 客户端（连接外部 MCP 服务器）
│       ├── cron_scheduler.py       # APScheduler 定时任务引擎
│       ├── plugin_service.py       # 插件管理
│       ├── file_service.py         # 文件操作服务
│       └── trash_service.py        # 回收站服务
├── frontend/
│   ├── index.html                  # 主页面（导航栏 + 内容容器）
│   ├── css/style.css               # 全局样式（Apple Mac 极简风格）
│   └── js/
│       ├── api.js                  # API 封装层
│       ├── components.js           # 公共组件（Toast/Modal/Badge/Icon...）
│       ├── app.js                  # 路由管理 + SSE + 全局事件
│       └── pages/                  # 13 个页面模块
│           ├── dashboard.js        # 仪表盘
│           ├── sessions.js         # 会话列表
│           ├── chat.js             # 聊天详情
│           ├── marketplace.js      # 扩展管理（MCP/技能/工具 三合一）
│           ├── memory.js           # 记忆管理
│           ├── plugins.js          # 插件市场
│           ├── cron.js             # 定时任务
│           ├── agents.js           # 子 Agent
│           ├── config.js           # 系统配置
│           ├── mcp.js              # MCP 服务（平台配置 + System Prompt）
│           ├── logs.js             # 操作日志
│           ├── about.js            # 关于 + CHANGELOG
│           └── trash.js            # 回收站
└── ~/.hermes/                      # 运行时数据目录
    ├── sessions.db                 # SQLite（会话 + 消息 + FTS5 索引）
    ├── config.yaml                 # 系统配置
    ├── logs/                       # 操作日志 JSON
    ├── skills/                     # 技能文件（.md + .meta.json）
    ├── memories/                   # MEMORY.md + USER.md
    ├── cron/                       # 定时任务执行日志
    ├── plugins/                    # 已安装插件
    ├── trash/                      # 回收站
    ├── SOUL.md                     # Agent 人格定义
    └── mcp_servers.json            # 外部 MCP 服务器配置
```

---

## 三、版本历史

| 版本 | 日期 | 里程碑 |
|------|------|--------|
| v1.0 | 04-28 18:00 | 项目初始化 |
| v1.5 | 04-28 19:00 | 前端全面管理权限 |
| v1.8 | 04-28 19:25 | 插件系统 + 实时对话记录 |
| v1.9 | 04-28 20:15 | 插件市场 + 数据动态化 |
| v2.0 | 04-28 22:00 | 正式版（54 项测试通过） |
| v2.2 | 04-28 23:30 | 多平台连接配置 + System Prompt |
| v2.3 | 04-29 00:30 | 核心工具补齐（37 个工具） |
| v2.4 | 04-29 01:00 | 数据能力增强（40 个工具） |
| **v3.0** | **04-29 01:30** | **MCP 网关 — 工具聚合器（44 个工具）** |

### 今日完成的主要工作

1. **硬编码审查** — 发现并修复 35 处硬编码（14 处 Mock 数据、版本号不一致、API 调用 bug）
2. **对比官方 Hermes Agent** — 详细功能差距分析，明确项目定位为 IDE 工具服务端
3. **Phase 1: 核心工具补齐** — 文件操作/终端执行/Web 搜索/定时任务引擎（29→37 工具）
4. **Phase 2: 数据能力增强** — 全文搜索/记忆管理/SOUL.md/技能 frontmatter（37→40 工具）
5. **Phase 3: MCP 网关** — 外部 MCP 服务器连接/工具聚合/路由转发（40→44 工具）
6. **扩展管理页面** — 外部 MCP/技能/工具 三合一 Tab 页面
7. **技能系统修复** — description + tags 完整支持 + meta.json 元数据

---

## 四、MCP 工具清单（44 个）

### 会话管理（6 个）
| 工具 | 说明 |
|------|------|
| `list_sessions` | 列出最近会话 |
| `search_sessions` | 按标题/模型搜索会话 |
| `get_session_messages` | 获取会话消息历史 |
| `create_session` | 创建新会话 |
| `add_message` | 向会话添加消息 |
| `delete_session` | 删除会话 |
| `log_conversation` | 记录对话到会话（IDE 调用入口） |

### 技能系统（5 个）
| 工具 | 说明 |
|------|------|
| `list_skills` | 列出技能（支持 frontmatter 元数据） |
| `get_skill_content` | 获取技能详细内容 |
| `create_skill` | 创建技能（支持 description + tags） |
| `update_skill` | 更新技能 |
| `delete_skill` | 删除技能 |

### 记忆/画像（4 个）
| 工具 | 说明 |
|------|------|
| `read_memory` | 读取长期记忆（返回 usage/limit） |
| `write_memory` | 写入记忆（自动去重 + 容量限制） |
| `read_user_profile` | 读取用户画像 |
| `write_user_profile` | 写入用户画像 |

### 文件操作（4 个）
| 工具 | 说明 |
|------|------|
| `read_file` | 读取文件（支持偏移/限制） |
| `write_file` | 写入文件（自动创建目录） |
| `list_directory` | 列出目录（支持 glob 过滤） |
| `search_files` | 正则搜索文件内容 |

### 终端/Web（3 个）
| 工具 | 说明 |
|------|------|
| `shell_execute` | 执行 shell 命令（超时 120s + 输出截断） |
| `web_search` | DuckDuckGo 搜索（降级 HTML 解析） |
| `web_fetch` | 抓取网页纯文本 |

### 定时任务（3 个）
| 工具 | 说明 |
|------|------|
| `list_cron_jobs` | 列出定时任务 |
| `create_cron_job` | 创建定时任务 |
| `delete_cron_job` | 删除定时任务 |

### 系统管理（7 个）
| 工具 | 说明 |
|------|------|
| `list_tools` | 列出所有工具及状态 |
| `get_system_status` | 获取系统状态 |
| `get_dashboard_summary` | 仪表盘摘要 |
| `get_logs` | 获取操作日志 |
| `get_config` | 获取系统配置 |
| `update_config` | 更新系统配置 |
| `search_messages` | 全文搜索消息（SQLite FTS5） |

### 插件系统（3 个）
| 工具 | 说明 |
|------|------|
| `list_plugins` | 列出已安装插件 |
| `install_plugin` | 安装插件（内置名或 Git URL） |
| `uninstall_plugin` | 卸载插件 |

### Context Files（2 个）
| 工具 | 说明 |
|------|------|
| `read_soul` | 读取 Agent 人格定义 |
| `write_soul` | 写入 Agent 人格定义 |

### MCP 网关（4 个）
| 工具 | 说明 |
|------|------|
| `add_mcp_server` | 添加外部 MCP 服务器 |
| `remove_mcp_server` | 移除外部 MCP 服务器 |
| `list_mcp_servers` | 列出所有外部服务器 |
| `refresh_mcp_servers` | 刷新所有服务器工具列表 |

---

## 五、前端页面清单

| 页面 | 路由 | 说明 |
|------|------|------|
| 仪表盘 | `#dashboard` | 统计概览 + 系统资源 + 趋势图 |
| 会话 | `#sessions` | 会话列表 + 实时消息流 |
| **扩展管理** | `#marketplace` | **外部 MCP / 技能 / 工具 三合一 Tab** |
| 记忆管理 | `#memory` | MEMORY.md + USER.md 编辑 |
| 插件市场 | `#plugins` | 17 个内置插件 + Git 安装 |
| 定时任务 | `#cron` | CRUD + 执行状态 |
| 子 Agent | `#agents` | 子 Agent 列表（依赖 hermes 模块） |
| MCP 服务 | `#mcp` | 平台配置 + System Prompt 模板 |
| 操作日志 | `#logs` | 按来源/级别过滤 + 统计 |
| 系统配置 | `#config` | YAML 配置编辑 |
| 关于 | `#about` | 版本信息 + CHANGELOG |
| 回收站 | `#trash` | 软删除恢复/永久删除 |
| API 文档 | `/docs` | Swagger UI（外部链接） |

---

## 六、关键架构决策

### 6.1 前端 HTML 内联构建

`app.py` 中的 `build_full_html()` 会将所有 CSS 和 JS 内联到一个 HTML 文件中，然后替换 Gradio 的默认首页。

**重要**: 每次新增 JS 页面文件时，必须在 `app.py` 的 `js_files` 列表中添加，否则页面会因变量未定义而崩溃。

```python
# app.py 第 47-57 行
js_files = [
    "js/api.js", "js/components.js",
    "js/pages/dashboard.js", ...
    "js/pages/marketplace.js",  # ← 新增页面必须加到这里
    ...
    "js/app.js",
]
```

### 6.2 MCP 协议双端点

- `POST /mcp` — Streamable HTTP（JSON-RPC 2.0）
- `GET /sse` — Server-Sent Events（实时事件推送）

### 6.3 SSE 事件系统

所有数据变更通过 SSE 推送到前端，前端通过 `onSSEEvent(type, data)` 统一处理。

事件类型: `session.created`, `session.message`, `skill.created`, `cron.triggered`, `config.updated` 等。

### 6.4 定时任务引擎

使用 APScheduler BackgroundScheduler，应用启动时自动加载已启用的任务。创建/更新/删除任务时自动重载调度器。

### 6.5 MCP 网关模式

`mcp_client_service.py` 作为 MCP 客户端连接外部服务器，自动发现工具并加前缀（`mcp_{name}_`），与本地工具统一暴露给 IDE。

---

## 七、已知限制和待办

### 当前空壳/降级功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 子 Agent | 空壳 | 仅有列表 API，无创建/委派能力（依赖 hermes 模块） |
| 上下文压缩 | 空壳 | API 存在但返回"未安装" |
| 插件工具执行 | 有限 | 插件工具定义已加载，但执行逻辑需自行实现 |

### 开发路线图

| 阶段 | 版本 | 内容 | 状态 |
|------|------|------|------|
| Phase 1 | v2.3 | 核心工具补齐 | ✅ 完成 |
| Phase 2 | v2.4 | 数据能力增强 | ✅ 完成 |
| Phase 3 | v3.0 | MCP 网关 | ✅ 完成 |
| Phase 4 | v3.1 | 自动化与智能（上下文压缩、Agent 自创技能、Skills Hub） | 待开发 |
| Phase 5 | v3.2+ | 生态扩展（浏览器自动化、子 Agent、消息平台） | 待开发 |

### 与官方 Hermes Agent 的差距

| 功能 | 官方 | 我们 | 差距 |
|------|------|------|------|
| LLM 调用层 | 18+ 提供者 | 不需要（IDE 提供） | — |
| Agent Loop | 完整循环 | 不需要（IDE 提供） | — |
| 消息平台网关 | 15+ 平台 | 不需要（定位不同） | — |
| MCP 客户端聚合 | 支持 | ✅ 已实现 | — |
| 终端执行 | 6 种后端 | subprocess only | 中 |
| 浏览器自动化 | Playwright | 无 | 高 |
| 安全系统 | 7 层防御 | 路径验证 only | 高 |

---

## 八、部署流程

### 日常开发推送

```bash
cd /workspace/hermes-mcp-space
git add -A
git commit -m "描述"
git push origin main
```

推送后 HF Space 自动构建，约 2-3 分钟生效。

### 版本号更新

修改以下 4 处（搜索替换）：

1. `backend/routers/dashboard.py` — `"3.0.0"`
2. `app.py` — `os.environ.get("APP_VERSION", "3.0.0")`
3. `backend/mcp_server.py` — `os.environ.get('APP_VERSION', '3.0.0')`
4. `frontend/js/api.js` — `const APP_VERSION = '3.0.0'`

### 新增前端页面

1. 创建 `frontend/js/pages/xxx.js`
2. 在 `app.py` 的 `js_files` 列表中添加
3. 在 `frontend/js/app.js` 的 `pages` 和 `pageTitles` 中注册
4. 在 `frontend/index.html` 导航栏中添加（可选）

### 新增 MCP 工具

1. 在 `backend/mcp_server.py` 的 `_get_tools()` 中添加工具定义
2. 在 `_call_tool()` 中添加处理逻辑
3. 工具名用 snake_case，description 用中文

### 新增后端 API

1. 在 `backend/routers/` 下创建或修改路由文件
2. 在 `backend/main.py` 或 `app.py` 中注册 `include_router`

---

## 九、踩坑记录

| 问题 | 根因 | 解决方案 |
|------|------|---------|
| 页面全部空白 | `marketplace.js` 未加入 `build_full_html()` 的 `js_files` | 新增页面必须加入列表 |
| 技能无法操作 | `SkillCreateRequest` 只有 name+content，缺少 description+tags | 扩展请求体 + 保存 meta.json |
| 版本号不一致 | api.js/about.js/dashboard.py 三处版本号不同 | 统一为 APP_VERSION 常量引用 |
| API 调用 bug | `API.request('GET', '/api/tools')` 参数顺序错误 | `API.request` 第一个参数是 path |
| Mock 数据误导 | 7 个文件残留 14 处假数据 | 全部移除，catch 改为空数组 |
| 定时任务不执行 | 只有 CRUD 无调度器 | 集成 APScheduler |
| 记忆无限增长 | 无容量限制 | MEMORY 2200 / USER 1375 字符限制 + 自动去重 |

---

## 十、依赖清单

### Python 依赖

```
fastapi
uvicorn
gradio
pyyaml
apscheduler
duckduckgo-search (可选，web_search 降级到 HTML 解析)
```

### 前端依赖

无（原生 JS + CSS，零依赖）

---

## 十一、快速验证命令

```bash
# 检查所有 JS 语法
for f in frontend/js/*.js frontend/js/pages/*.js; do
  node --check "$f" || echo "FAIL: $f"
done

# 检查所有 Python 语法
python3 -c "
import py_compile
for f in ['app.py', 'backend/mcp_server.py', 'backend/services/hermes_service.py']:
    py_compile.compile(f, doraise=True)
"

# 验证 HTML 内联构建
python3 -c "from app import build_full_html; html = build_full_html(); print(f'OK: {len(html)} bytes')"

# 测试 MCP 工具
curl -s -X POST http://localhost:7860/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"result\"][\"tools\"])} tools')"

# 测试 API
curl -s http://localhost:7860/api/status | python3 -m json.tool
```
