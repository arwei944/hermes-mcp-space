# API 版本迁移指南 (v6.x → v7.0)

## 概述

v7.0.0 引入了 API 版本控制，所有端点支持 `/api/v1/` 前缀。

## 兼容性

- 所有 `/api/*` 端点继续可用（向后兼容）
- 新增 `/api/v1/*` 端点，行为与原端点完全一致
- 未来 v8.0 将废弃 `/api/*`，仅保留 `/api/v2/*`

## 迁移步骤

1. 将请求路径从 `/api/sessions` 改为 `/api/v1/sessions`
2. 其他端点同理
3. 无需修改请求/响应格式

## 端点映射

| 旧路径 | 新路径 |
|--------|--------|
| /api/sessions | /api/v1/sessions |
| /api/tools | /api/v1/tools |
| /api/skills | /api/v1/skills |
| /api/memory | /api/v1/memory |
| /api/cron | /api/v1/cron |
| /api/agents | /api/v1/agents |
| /api/config | /api/v1/config |
| /api/mcp | /api/v1/mcp |
| /api/plugins | /api/v1/plugins |
| /api/persistence | /api/v1/persistence |
| /api/knowledge | /api/v1/knowledge |
| /api/trash | /api/v1/trash |
