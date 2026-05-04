# 部署指南

## 数据持久化（重要）

Hermes 的所有数据（知识库、会话、记忆、学习记录等）默认存储在容器内 `~/.hermes/` 目录。**如果不配置持久化，容器重建后所有数据将丢失。**

### 方式一：HF Buckets（推荐，HF Spaces 原生）

1. 创建一个 HF Dataset 仓库（私有）
2. 在 HF Spaces Settings 添加 Secrets：
   - `PERSISTENCE_HF_REPO_ID` = 你的 Dataset 仓库 ID
   - `HF_TOKEN` = 你的 HF Token（需要 write 权限）
3. 系统会自动备份和恢复

### 方式二：Git 仓库同步

1. 创建 Git 仓库
2. 添加 Secret：`PERSISTENCE_GIT_REPO_URL`

### 持久化范围

| 文件 | 说明 |
|------|------|
| `data/knowledge.db` | 知识库 |
| `data/sessions.db` | 会话数据库 |
| `data/sessions.json` | 会话 JSON |
| `data/logs.json` | 操作日志 |
| `data/cron_jobs.json` | 定时任务 |
| `mcp_servers.json` | MCP 配置 |
| `memories/MEMORY.md` | AI 记忆 |
| `memories/USER.md` | 用户画像 |
| `learnings.md` | 学习记录 |
| `logs/tool_traces.jsonl` | 工具追踪 |

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PERSISTENCE_HF_REPO_ID | HF Dataset 仓库 ID | "" |
| PERSISTENCE_GIT_REPO_URL | Git 仓库 URL | "" |
| HF_TOKEN | HF API Token | "" |
| APP_VERSION | 应用版本 | 7.0.0 |
| AUTH_TOKEN | 认证 token | "" |