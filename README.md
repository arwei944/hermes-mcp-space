---
title: Hermes Agent MCP Space
emoji: ☤
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: "5.49.1"
python_version: "3.11"
app_file: app.py
pinned: false
---

# Hermes Agent MCP Space

> **GitHub**: [arwei944/hermes-mcp-space](https://github.com/arwei944/hermes-mcp-space) | **魔搭**: [arwei944/hermes-mcp-space](https://www.modelscope.cn/arwei944/hermes-mcp-space)

基于 [Hermes Agent](https://github.com/NousResearch/hermes-agent) 的 MCP（Model Context Protocol）集成服务，部署为 ModelScope Gradio SDK Space，供 Trae、Cursor 等 MCP 客户端连接使用。

## 项目简介

本项目将 Hermes Agent 的全部能力通过 MCP 协议暴露给外部 IDE 和工具，同时提供 Web 管理面板。支持两种部署模式：

- **Gradio SDK 模式**：部署到魔搭社区（ModelScope），通过 SSE 传输协议供远程客户端连接
- **本地 stdio 模式**：直接在本地运行，通过标准输入/输出供 IDE 集成

## 功能特性

### MCP 工具（24 个）

| 类别 | 工具 | 说明 |
|------|------|------|
| **网络** | `hermes_web_search` | 网页搜索 |
| | `hermes_web_extract` | 网页内容提取 |
| **文件** | `hermes_read_file` | 读取文件 |
| | `hermes_write_file` | 写入文件 |
| | `hermes_patch_file` | 补丁修改文件 |
| | `hermes_search_files` | 搜索文件内容 |
| **执行** | `hermes_terminal` | 终端命令执行 |
| | `hermes_execute_code` | 执行 Python 代码 |
| **图片** | `hermes_vision_analyze` | 图片分析 |
| | `hermes_image_generate` | 图片生成 |
| **记忆** | `hermes_memory_read` | 读取记忆 |
| | `hermes_memory_write` | 写入记忆 |
| **技能** | `hermes_skills_list` | 列出技能 |
| | `hermes_skill_view` | 查看技能 |
| **会话** | `hermes_session_search` | 搜索历史会话 |
| **任务** | `hermes_delegate_task` | 委托子任务 |
| | `hermes_todo` | 任务规划 |
| | `hermes_cronjob_manage` | 定时任务管理 |
| **通信** | `hermes_send_message` | 发送消息 |
| **浏览器** | `hermes_browser_navigate` | 浏览器导航 |
| | `hermes_browser_click` | 浏览器点击 |
| | `hermes_browser_type` | 浏览器输入 |
| | `hermes_browser_screenshot` | 浏览器截图 |
| **语音** | `hermes_text_to_speech` | 文字转语音 |

### 管理面板

- 会话管理（查看、搜索、删除）
- 工具和技能管理
- 记忆管理
- 定时任务管理
- 子 Agent 管理
- MCP 服务状态监控

## 部署到魔搭社区

### 前置条件

1. 注册 [魔搭社区](https://modelscope.cn/) 账号
2. 创建一个新的 Gradio SDK Space

### 部署步骤

1. **上传项目文件**

   将以下文件上传到 Space 根目录：

   ```
   hermes-mcp-space/
   ├── app.py                  # Gradio 入口（必须）
   ├── mcp_server.py           # MCP 服务端
   ├── requirements.txt        # Python 依赖（必须）
   ├── config.yaml.example     # 配置示例
   ├── Dockerfile              # Docker 构建文件
   ├── backend/                # 管理面板后端
   │   ├── __init__.py
   │   ├── main.py
   │   ├── config.py
   │   ├── routers/
   │   │   ├── __init__.py
   │   │   ├── sessions.py
   │   │   ├── tools.py
   │   │   ├── skills.py
   │   │   ├── memory.py
   │   │   ├── cron.py
   │   │   ├── agents.py
   │   │   ├── config_api.py
   │   │   └── mcp.py
   │   └── services/
   │       ├── __init__.py
   │       ├── hermes_service.py
   │       └── file_service.py
   └── frontend/               # 管理面板前端
       ├── index.html
       ├── css/
       │   └── style.css
       └── js/
           ├── app.js
           ├── api.js
           ├── components.js
           └── pages/
               ├── dashboard.js
               ├── sessions.js
               ├── tools.js
               ├── skills.js
               ├── memory.js
               ├── cron.js
               ├── agents.js
               ├── config.js
               └── mcp.js
   ```

2. **配置环境变量**（可选）

   在 Space 设置中添加以下环境变量：

   | 变量名 | 默认值 | 说明 |
   |--------|--------|------|
   | `PANEL_PORT` | `7860` | 管理面板端口 |
   | `MCP_SSE_PORT` | `8765` | MCP SSE 端口 |
   | `ENABLE_MCP_SSE` | `true` | 是否启用 MCP SSE |
   | `HERMES_HOME` | `~/.hermes` | Hermes 数据目录 |
   | `LOG_LEVEL` | `INFO` | 日志级别 |

3. **等待部署完成**

   Space 会自动安装依赖并启动服务。启动成功后，Gradio 界面和管理面板均可通过 Space URL 访问。

## Trae 连接 MCP 配置

### 远程 SSE 模式（连接部署在魔搭的 Space）

1. 打开 Trae 设置 -> MCP 配置
2. 添加以下配置：

```json
{
  "mcpServers": {
    "hermes": {
      "url": "https://your-space-url.modelscope.cn/sse"
    }
  }
}
```

> 将 `your-space-url` 替换为你的 Space 实际地址。SSE 端点路径为 `/sse`，端口为 `8765`。如果 Space 使用了自定义域名，请相应调整。

### 本地 stdio 模式

1. 克隆项目到本地
2. 安装依赖：`pip install -r requirements.txt`
3. 在 Trae MCP 配置中添加：

```json
{
  "mcpServers": {
    "hermes": {
      "command": "python",
      "args": ["/path/to/hermes-mcp-space/mcp_server.py"]
    }
  }
}
```

### Cursor 配置

与 Trae 配置方式相同，在 Cursor 的 MCP 设置中添加相同的 JSON 配置即可。

## 本地开发指南

### 环境要求

- Python 3.10+
- pip

### 安装

```bash
# 克隆项目
git clone https://github.com/your-repo/hermes-mcp-space.git
cd hermes-mcp-space

# 安装依赖
pip install -r requirements.txt

# 复制配置文件（可选）
cp config.yaml.example ~/.hermes/config.yaml
```

### 运行 MCP Server（stdio 模式）

```bash
python mcp_server.py
```

### 运行 MCP Server（SSE 模式）

```bash
python mcp_server.py --transport sse --port 8765
```

### 运行完整服务（Gradio + 管理面板 + MCP SSE）

```bash
python app.py
```

访问 http://localhost:7860 查看 Gradio 界面和管理面板。

### 命令行参数

```
python mcp_server.py [OPTIONS]

选项:
  --transport {stdio,sse}  传输方式（默认: stdio）
  --host HOST              SSE 模式监听地址（默认: 0.0.0.0）
  --port PORT              SSE 模式监听端口（默认: 8765）
  --verbose                启用详细日志输出
```

### Docker 构建

```bash
# 构建镜像
docker build -t hermes-mcp-space .

# 运行容器
docker run -d \
  -p 7860:7860 \
  -p 8765:8765 \
  -v ~/.hermes:/root/.hermes \
  --name hermes-mcp \
  hermes-mcp-space
```

## 项目结构

```
hermes-mcp-space/
├── app.py                  # Gradio SDK 入口（Space 启动文件）
├── mcp_server.py           # MCP 服务端（FastMCP 实现）
├── requirements.txt        # Python 依赖
├── Dockerfile              # Docker 构建文件
├── config.yaml.example     # 配置示例
├── backend/                # 管理面板后端（FastAPI）
│   ├── __init__.py
│   ├── main.py             # FastAPI 应用入口
│   ├── config.py           # 配置管理
│   ├── routers/            # API 路由
│   │   ├── sessions.py     # 会话管理 API
│   │   ├── tools.py        # 工具管理 API
│   │   ├── skills.py       # 技能管理 API
│   │   ├── memory.py       # 记忆管理 API
│   │   ├── cron.py         # 定时任务 API
│   │   ├── agents.py       # 子 Agent API
│   │   ├── config_api.py   # 配置管理 API
│   │   └── mcp.py          # MCP 状态 API
│   └── services/           # 业务逻辑
│       ├── hermes_service.py
│       └── file_service.py
└── frontend/               # 管理面板前端
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js
        ├── api.js
        ├── components.js
        └── pages/
```

## 降级模式

当 Hermes 核心模块未安装时，MCP Server 会自动进入降级模式：

- **可用工具**：文件读写、终端执行、代码执行、网页搜索/提取、记忆读写、技能查看、任务规划、定时任务管理
- **不可用工具**：图片分析/生成、浏览器控制、语音合成、消息发送、子任务委托（这些工具需要 Hermes 原生支持）

降级模式下，不可用的工具会返回友好的错误提示，不会导致服务崩溃。

## 截图

<!-- TODO: 添加截图 -->
<!-- - Gradio 界面截图 -->
<!-- - 管理面板截图 -->
<!-- - Trae MCP 连接截图 -->

## 许可证

MIT License
