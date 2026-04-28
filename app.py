# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Space - 部署入口
使用 Gradio 托管前端 + FastAPI 提供后端 API，共用 7860 端口
"""

import logging
import os

# ==================== 日志配置 ====================
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("hermes-space")

HERMES_HOME = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))


# ==================== 构建前端 HTML ====================

def build_frontend_html() -> str:
    """构建完整的 Obsidian 风格前端 HTML（内联 CSS 和 JS）"""
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

    # 读取 CSS
    try:
        with open(os.path.join(frontend_dir, "css", "style.css"), "r", encoding="utf-8") as f:
            css_content = f.read()
    except Exception:
        css_content = "body{font-family:sans-serif;padding:20px;background:#1e1e2e;color:#e0e0e0;}"

    # 读取各 JS 模块
    js_modules = [
        "js/api.js", "js/components.js",
        "js/pages/dashboard.js", "js/pages/sessions.js", "js/pages/tools.js",
        "js/pages/skills.js", "js/pages/memory.js", "js/pages/cron.js",
        "js/pages/agents.js", "js/pages/config.js", "js/pages/mcp.js",
        "js/app.js",
    ]
    js_content = ""
    for js_file in js_modules:
        try:
            with open(os.path.join(frontend_dir, js_file), "r", encoding="utf-8") as f:
                js_content += f"\n// === {js_file} ===\n" + f.read() + "\n"
        except Exception as e:
            logger.warning(f"无法加载 {js_file}: {e}")

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hermes Agent 管理面板</title>
<style>
{css_content}
</style>
</head>
<body>
<aside class="sidebar">
    <div class="sidebar-header"><span class="logo">🤖 Hermes</span></div>
    <div class="sidebar-search"><input type="text" placeholder="搜索... (Ctrl+K)" id="globalSearch"></div>
    <nav class="sidebar-nav">
        <a href="#dashboard" class="nav-item active" data-page="dashboard"><span class="nav-icon">📊</span> 仪表盘</a>
        <a href="#sessions" class="nav-item" data-page="sessions"><span class="nav-icon">💬</span> 会话管理</a>
        <a href="#tools" class="nav-item" data-page="tools"><span class="nav-icon">🔧</span> 工具管理</a>
        <a href="#skills" class="nav-item" data-page="skills"><span class="nav-icon">⚡</span> 技能系统</a>
        <a href="#memory" class="nav-item" data-page="memory"><span class="nav-icon">🧠</span> 记忆管理</a>
        <a href="#cron" class="nav-item" data-page="cron"><span class="nav-icon">⏰</span> 定时任务</a>
        <a href="#agents" class="nav-item" data-page="agents"><span class="nav-icon">🤖</span> 子 Agent</a>
        <a href="#mcp" class="nav-item" data-page="mcp"><span class="nav-icon">🔌</span> MCP 服务</a>
        <a href="#config" class="nav-item" data-page="config"><span class="nav-icon">⚙️</span> 系统配置</a>
    </nav>
    <div class="sidebar-footer"><div class="status-indicator"><span class="status-dot"></span><span class="status-text">已连接</span></div></div>
</aside>
<main class="main-content">
    <header class="content-header"><h1 id="pageTitle">仪表盘</h1><div class="header-actions"><button class="btn btn-primary" id="refreshBtn">🔄 刷新</button></div></header>
    <div class="content-body" id="contentBody"><p>加载中...</p></div>
</main>
<div class="modal-overlay" id="modalOverlay"><div class="modal" id="modal"><div class="modal-header"><h2 id="modalTitle"></h2><button class="modal-close" id="modalClose">✕</button></div><div class="modal-body" id="modalBody"></div></div></div>
<div class="toast-container" id="toastContainer"></div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
{js_content}
</script>
</body>
</html>"""


# ==================== 创建 Gradio 应用 ====================

logger.info("正在初始化 Hermes Agent MCP Space...")

import gradio as gr

frontend_html = build_frontend_html()

with gr.Blocks(
    title="Hermes Agent MCP Space",
    css=".gradio-container{max-width:100%!important;padding:0!important;}.gradio-container .prose{max-width:100%!important;}",
) as demo:
    gr.HTML(frontend_html)

# 挂载 FastAPI 路由到 Gradio 内部的 FastAPI app
try:
    from backend.routers import sessions, tools, skills, memory, cron, agents, config_api, mcp as mcp_router
    demo.app.include_router(sessions.router, prefix="/api")
    demo.app.include_router(tools.router, prefix="/api")
    demo.app.include_router(skills.router, prefix="/api")
    demo.app.include_router(memory.router, prefix="/api")
    demo.app.include_router(cron.router, prefix="/api")
    demo.app.include_router(agents.router, prefix="/api")
    demo.app.include_router(config_api.router, prefix="/api")
    demo.app.include_router(mcp_router.router, prefix="/api")
    logger.info("后端 API 路由加载成功")
except Exception as e:
    logger.warning(f"后端 API 路由加载失败（降级模式）: {e}")

# 健康检查
@demo.app.get("/api/health")
async def health():
    return {"status": "ok", "service": "hermes-mcp-space"}

logger.info("Hermes Agent MCP Space 初始化完成")
