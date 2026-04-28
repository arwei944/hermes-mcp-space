# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Space - 部署入口
Gradio 托管 Obsidian 风格前端管理面板
"""

import logging
import os

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("hermes-space")


def build_frontend_html() -> str:
    """构建完整的 Obsidian 风格前端 HTML（内联 CSS 和 JS）"""
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

    try:
        with open(os.path.join(frontend_dir, "css", "style.css"), "r", encoding="utf-8") as f:
            css_content = f.read()
    except Exception:
        css_content = "body{font-family:sans-serif;padding:20px;background:#1e1e2e;color:#e0e0e0;}"

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


logger.info("正在初始化 Hermes Agent MCP Space...")

import gradio as gr

frontend_html = build_frontend_html()

with gr.Blocks(
    title="Hermes Agent MCP Space",
    css=".gradio-container{max-width:100%!important;padding:0!important;}.gradio-container .prose{max-width:100%!important;}",
) as demo:
    gr.HTML(frontend_html)

logger.info("Hermes Agent MCP Space 初始化完成")
