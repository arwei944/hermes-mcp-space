# Hermes MCP Space — 整合开发计划

> 基于 AI 工程实践指南 + 原有路线图深度融合
> 更新时间: 2026-04-29 | 当前版本: v3.0.0

---

## 设计原则

> **"弱 AI 产品和强 AI 产品之间的差距几乎从来不是模型，而是工程层。"**

本计划将《2026 AI 工程实践指南》的核心原则与原有 Phase 4-5 路线图深度融合，按依赖关系和价值密度重新排列，形成 v3.1 → v4.0 的完整演进路径。

### 指南整合映射

| 指南原则 | 对应版本 | 对应功能 |
|---------|---------|---------|
| 3.1 错误信息 = 指令 | v3.1 | 错误信息指令化 |
| 3.3 Evals 不是可选的 | v3.1 | 工具调用追踪 + Evals 仪表盘 |
| 1.1 环境即 Agent | v3.1 | AGENTS.md 支持 |
| 5.4 学习循环 | v3.1 | learnings.md 自动维护 |
| 1.2 一个 Shell 替代工具注册表 | v3.1 | shell_execute 增强 |
| 1.3 数据翻译成模型语言 | v3.2 | 技能条件激活 + 上下文压缩 |
| 2.1 链式调用 > 单 Prompt | v3.2 | Agent 自创技能 |
| 2.2 多 Agent 分工 | v3.3 | micro-squad + 子 Agent 委派 |
| 3.2 多 Agent 对抗验证 | v3.3 | 双盲评审技能 |

---

## 版本全景图

```
v3.0 ─── 当前 ─── MCP 网关（44 工具）
  │
  ├── v3.1 ─── 工程层加固（指南整合）
  │     错误指令化 + 工具追踪 + AGENTS.md + 学习循环
  │
  ├── v3.2 ─── 自动化与智能
  │     上下文压缩 + Agent 自创技能 + Skills Hub
  │
  ├── v3.3 ─── 多 Agent 工作流
  │     micro-squad 技能 + 子 Agent 委派 + 双盲评审
  │
  └── v4.0 ─── 生态扩展
        浏览器自动化 + 消息平台 + 外部记忆
```

---

## v3.1 — 工程层加固

> 核心目标：工具从"能用"变为"好用"，IDE 体验质变
> 预计工作量：1-2 天

### 3.1.1 错误信息指令化

**来源**: 指南 3.1 — "把错误信息设计成指令，而不是诊断"

将所有 44 个 MCP 工具的错误路径从诊断式改为指令式。

**改造示例**:

```
# 改造前（诊断式）
❌ "文件不存在: /path/to/file"
❌ "搜索失败: timeout"
❌ "命令执行超时（30秒）"

# 改造后（指令式）
✅ "文件 /path/to/file 不存在。建议：
   1. 使用 list_directory 确认父目录路径
   2. 检查文件名拼写
   3. 确认文件扩展名是否正确"

✅ "搜索超时（10秒）。建议：
   1. 缩小搜索范围（指定更精确的 path）
   2. 使用 file_pattern 过滤文件类型（如 *.py）
   3. 减少 max_results（当前 20）"

✅ "命令执行超时（30秒）。建议：
   1. 将任务拆分为多个小命令
   2. 增加 timeout 参数（最大 120 秒）
   3. 使用 && 串联命令减少调用次数"
```

**覆盖范围**: `_call_tool()` 中所有 `raise ValueError(...)` 和错误返回

**验收标准**: 所有工具的错误信息包含"原因 + 至少 2 条修复建议"

---

### 3.1.2 工具调用追踪

**来源**: 指南 3.3 — "面试 AI 创业公司必问：你们有 LLM Traces 吗？"

在每次 MCP 工具调用时记录结构化日志。

**记录字段**:

| 字段 | 说明 |
|------|------|
| `timestamp` | 调用时间 |
| `tool_name` | 工具名 |
| `arguments` | 输入参数（脱敏） |
| `success` | 是否成功 (bool) |
| `latency_ms` | 执行耗时 |
| `error` | 错误信息（失败时） |
| `source` | 调用来源（MCP/REST/SSE） |

**存储**: 追加写入 `~/.hermes/logs/tool_traces.jsonl`（每行一条 JSON）

**实现位置**: `mcp_server.py` 的 `handle_mcp()` 和 `_call_tool()` 前后

---

### 3.1.3 Evals 仪表盘

**来源**: 指南 3.3 — "每个模糊步骤在上线前都需要一个自动化 eval"

Dashboard 新增工具使用统计面板。

**新增指标**:

| 指标 | 说明 |
|------|------|
| 总调用次数 | 按工具分组 |
| 成功率 | 成功次数 / 总次数 |
| 平均延迟 | 按工具分组的平均执行时间 |
| 热力图 | 调用频次 Top 10 工具 |
| 错误模式 | Top 5 失败工具 + 失败原因分布 |
| 趋势图 | 过去 7 天调用次数趋势 |

**新增 API**:
- `GET /api/evals/summary` — 工具使用统计摘要
- `GET /api/evals/tools` — 按工具分组的详细统计
- `GET /api/evals/errors` — 错误模式分析

**前端**: Dashboard 页面新增"工具 Evals"折叠面板

---

### 3.1.4 AGENTS.md 支持

**来源**: 指南 1.1 — "环境即 Agent，工作目录里放什么比编排代码更重要"

支持项目级指令文件 `AGENTS.md`，Agent 启动时自动加载。

**文件发现顺序**（优先级从高到低）:
1. `~/.hermes/AGENTS.md` — 全局指令
2. 当前工作目录 `./AGENTS.md` — 项目指令
3. `./CLAUDE.md` — Claude Code 兼容
4. `.cursor/rules/*.mdc` — Cursor 兼容

**MCP 工具增强**:
- `get_system_status` 返回中新增 `agents_md` 字段（内容摘要）
- `read_soul` / `write_soul` 扩展为通用 Context Files 读写

**新增 MCP 工具**:

| 工具 | 说明 |
|------|------|
| `read_agents_md` | 读取 AGENTS.md 项目指令 |
| `write_agents_md` | 写入 AGENTS.md 项目指令 |

---

### 3.1.5 学习循环

**来源**: 指南 5.4 — "每次 Sprint 捕获关键发现，系统在多次运行中越来越聪明"

自动维护 `~/.hermes/learnings.md`，记录工具使用中的关键发现。

**触发条件**:
- 工具调用失败 3 次以上（同一工具同一错误）
- 用户手动通过 `add_learning` 记录

**自动记录格式**:

```markdown
## [2026-04-29] web_search 常见失败
- **工具**: web_search
- **错误**: DuckDuckGo HTML 解析返回空结果
- **建议**: 使用更精确的英文关键词，或尝试 web_fetch 直接抓取
- **频次**: 5 次
```

**新增 MCP 工具**:

| 工具 | 说明 |
|------|------|
| `read_learnings` | 读取学习记录（返回最近 20 条） |
| `add_learning` | 手动添加学习记录 |
| `search_learnings` | 搜索学习记录 |

**容量管理**: 上限 50 条，自动淘汰最旧条目

**注入**: `get_system_status` 返回中新增 `learnings_count` 和最近 5 条摘要

---

### 3.1.6 shell_execute 增强

**来源**: 指南 1.2 — "一个 Shell 替代一整个工具注册表"

增强 shell_execute 的错误信息和使用体验。

**改进项**:

| 改进 | 说明 |
|------|------|
| 错误建议 | 命令失败时给出修复建议（如 "command not found: suggest installing..."） |
| 超时提示 | 超时时建议拆分命令或增加 timeout |
| 输出格式化 | 长输出自动分页，显示 "共 N 行，显示第 1-500 行" |
| 工作目录提示 | cwd 不存在时提示可用目录 |

---

## v3.2 — 自动化与智能

> 核心目标：Agent 具备自动化能力和自我进化能力
> 预计工作量：3-4 天

### 3.2.1 上下文压缩

**来源**: 原 Phase 4

长对话自动摘要压缩，防止上下文溢出。

**实现**:
- 新增 MCP 工具 `compress_session` — 对指定会话进行摘要压缩
- 保留最近 3 轮 + 最早 1 轮，中间轮次由 LLM 摘要
- 摘要结果保存为会话的 `summary` 字段
- `get_session_messages` 返回时包含摘要

**依赖**: 需要配置 LLM API（OpenAI 兼容格式）

---

### 3.2.2 Agent 自创技能

**来源**: 指南 2.1 + 原 Phase 4

Agent 在成功完成复杂任务后自动建议创建技能。

**触发条件**:
- 单次会话中同一工具被调用 5 次以上
- 或用户手动触发 `suggest_skill`

**流程**:
1. 分析会话中的工具调用序列
2. 提取重复模式
3. 生成技能草案（SKILL.md 格式）
4. 通过 `log_conversation` 记录建议
5. 用户确认后通过 `create_skill` 保存

**新增 MCP 工具**:

| 工具 | 说明 |
|------|------|
| `suggest_skill` | 分析当前会话，建议创建技能 |

---

### 3.2.3 Skills Hub 在线市场

**来源**: 原 Phase 4

对接 skills.sh 公共技能目录，在线浏览/搜索/安装技能。

**新增 MCP 工具**:

| 工具 | 说明 |
|------|------|
| `search_skills_hub` | 在线搜索技能市场 |
| `install_skill_hub` | 从市场安装技能 |
| `list_installed_skills` | 列出已安装的市场技能 |

**前端**: 扩展管理页面"技能"Tab 新增"市场"按钮

---

### 3.2.4 技能条件激活

**来源**: 指南 1.3 + 原 Phase 4

基于 frontmatter 的 `requires_toolsets` / `fallback_for_toolsets` 过滤可用技能。

**实现**:
- `list_skills` 接收可选参数 `available_tools`
- 解析 SKILL.md frontmatter 中的条件
- 仅返回满足条件的技能（减少 token 使用）

**frontmatter 示例**:

```yaml
---
name: python-debug
description: Python 调试技能
requires_toolsets: [terminal]
fallback_for_toolsets: [web]
---
```

---

### 3.2.5 对话统计图表

**来源**: 原 Phase 4

Dashboard 新增对话统计面板。

**图表**:

| 图表 | 说明 |
|------|------|
| 每日消息量 | 过去 7 天柱状图 |
| 活跃时段 | 24 小时热力图 |
| 工具调用频率 | Top 10 工具饼图 |
| 会话长度分布 | 消息数直方图 |

**新增 API**:
- `GET /api/stats/messages` — 消息统计
- `GET /api/stats/tools` — 工具调用统计
- `GET /api/stats/sessions` — 会话统计

---

## v3.3 — 多 Agent 工作流

> 核心目标：支持多 Agent 协作和对抗验证
> 预计工作量：5-7 天

### 3.3.1 micro-squad 内置技能

**来源**: 指南 5

将 micro-squad 安装为内置技能，支持标准化 Sprint 工作流。

**命令支持**:

| 命令 | 功能 |
|------|------|
| `/squad <task>` | 完整 Sprint（THINK→PLAN→BUILD→VERIFY→SHIP） |
| `/think` | 强制提问挑战假设 |
| `/plan` | 并行规划 |
| `/build` | 带约束的实现 |
| `/verify` | 双盲评审 + QA |
| `/ship` | 带完整证据链的提交 |

**实现**: 从 GitHub 克隆 micro-squad，适配为 Hermes 技能格式

---

### 3.3.2 子 Agent 委派

**来源**: 原 Phase 5

`delegate_task` 工具创建隔离子 Agent 并行工作。

**MCP 工具**:

| 工具 | 说明 |
|------|------|
| `delegate_task` | 创建子 Agent 执行任务 |
| `list_agents` | 列出运行中的子 Agent（已有） |
| `get_agent_status` | 获取子 Agent 状态和输出 |
| `stop_agent` | 终止子 Agent |

**实现**:
- 子 Agent 在独立线程中运行
- 共享工具集和记忆
- 结果通过 SSE 事件推送

---

### 3.3.3 双盲评审技能

**来源**: 指南 3.2

两个 Judge Agent 并行审查，共识表裁决。

**流程**:
1. 提交代码/文档给评审
2. Judge A 和 Judge B 并行审查（互不知道对方）
3. 生成共识表（FIX / TRIAGE / DISMISS）
4. FIX 项自动修复后重新评审（最多 2 轮）

**裁决规则**:

| 裁决 | 条件 |
|------|------|
| FIX | 2+ 个 Agent 发现，或任何单个 CRITICAL |
| TRIAGE | 仅 1 个 Agent 发现（非严重） |
| DISMISS | 被其他 Agent 反驳 + 仅 SUGGESTION |

---

## v4.0 — 生态扩展

> 核心目标：完整的 Agent 生态
> 预计工作量：持续迭代

### 4.0.1 浏览器自动化

集成 Playwright，提供 `browser_*` 工具集。

**工具列表**: browser_navigate / browser_snapshot / browser_click / browser_type / browser_screenshot / browser_scroll 等

**注意**: HF Space 资源有限，建议作为可选功能

---

### 4.0.2 消息平台 Webhook

支持 Telegram Bot / 飞书机器人等消息平台。

**实现**: Webhook 模式接收消息 → 调用 MCP 工具处理 → 回复

---

### 4.0.3 外部记忆提供者

集成 Mem0 / 知识图谱等外部记忆服务。

**实现**: 插件化架构，通过配置切换记忆后端

---

## 工具数量演进

```
v3.0:  44 个（当前）
v3.1:  48 个（+read_agents_md, write_agents_md, read_learnings, add_learning）
v3.2:  53 个（+compress_session, suggest_skill, search_skills_hub, install_skill_hub, list_installed_skills）
v3.3:  57 个（+delegate_task, get_agent_status, stop_agent）
v4.0:  67+ 个（+browser_* 系列等）
```

---

## 里程碑时间线

```
2026-04-29  v3.0  ─── 当前：MCP 网关
     │
     ├── v3.1 (1-2天) ─── 工程层加固
     │     ✅ 错误指令化
     │     ✅ 工具调用追踪
     │     ✅ Evals 仪表盘
     │     ✅ AGENTS.md
     │     ✅ 学习循环
     │     ✅ shell_execute 增强
     │
     ├── v3.2 (3-4天) ─── 自动化与智能
     │     ✅ 上下文压缩
     │     ✅ Agent 自创技能
     │     ✅ Skills Hub
     │     ✅ 技能条件激活
     │     ✅ 对话统计图表
     │
     ├── v3.3 (5-7天) ─── 多 Agent 工作流
     │     ✅ micro-squad
     │     ✅ 子 Agent 委派
     │     ✅ 双盲评审
     │
     └── v4.0 (持续) ─── 生态扩展
           🔲 浏览器自动化
           🔲 消息平台
           🔲 外部记忆
```

---

## 验收标准

每个版本发布前必须通过：

1. **JS 语法检查** — 所有前端文件 `node --check` 通过
2. **Python 语法检查** — 所有后端文件 `py_compile` 通过
3. **HTML 内联构建** — `build_full_html()` 正常生成
4. **MCP 工具测试** — `tools/list` 返回正确数量
5. **新工具冒烟测试** — 每个新工具至少调用一次验证
6. **错误信息检查** — 所有错误信息包含"原因 + 建议"
7. **Git 提交** — 规范 commit message + push
