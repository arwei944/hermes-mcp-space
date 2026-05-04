# 部署指南

## 数据持久化（重要）

Hermes 的所有数据默认存储在容器内 `~/.hermes/` 目录。**如果不配置持久化，容器重建后所有数据将丢失。**

### 方式一：HF Buckets（推荐，HF Spaces 原生）

1. 创建一个 HF Dataset 仓库（私有）：前往 https://huggingface.co/new → 选择 "Dataset" → 设为 Private
2. 在 HF Spaces 的 Settings → Variables and secrets 中添加：
   - `PERSISTENCE_HF_REPO_ID` = `arwei944/hermes-data`
   - `HF_TOKEN` = `hf_xxxxx`
3. 系统会自动：启动时恢复数据、每小时自动备份、关闭前备份

### 方式二：Git 仓库同步

1. 创建一个 Git 仓库
2. 在 HF Spaces Secrets 中添加：`PERSISTENCE_GIT_REPO_URL` = `https://user:token@github.com/xxx/hermes-data.git`

### 持久化的数据范围

| 文件 | 说明 |
|------|------|
| `data/knowledge.db` | 知识库（规则/知识/经验/记忆/审核） |
| `data/sessions.db` | 会话数据库 |
| `data/sessions.json` | 会话 JSON 兼容格式 |
| `data/logs.json` | 操作日志 |
| `data/cron_jobs.json` | 定时任务配置 |
| `mcp_servers.json` | MCP 服务配置 |
| `memories/MEMORY.md` | AI 长期记忆 |
| `memories/USER.md` | 用户画像 |
| `learnings.md` | 学习记录 |
| `logs/tool_traces.jsonl` | 工具调用追踪 |

### 验证持久化是否生效

启动后查看日志，应看到：
```
Persistence backend initialized: hf_buckets
Startup restore: 恢复完成 (X 个文件)
Data integrity check: ok (X checks, 0 issues, 0 auto-fixed)
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PERSISTENCE_HF_REPO_ID` | HF Dataset 仓库 ID | "" |
| `PERSISTENCE_GIT_REPO_URL` | Git 仓库 URL | "" |
| `HF_TOKEN` | HF API Token | "" |