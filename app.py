# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Space - 部署入口
Gradio 托管 Mac 极简风格前端管理面板
支持版本管理和热更新
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

# ==================== 版本管理 ====================
APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
BUILD_TIME = os.environ.get("BUILD_TIME", "2026-04-28")


def build_frontend_html() -> str:
    """构建完整的 Mac 极简风格前端 HTML（内联 CSS 和 JS）"""
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

    # 读取 CSS
    try:
        with open(os.path.join(frontend_dir, "css", "style.css"), "r", encoding="utf-8") as f:
            css_content = f.read()
    except Exception:
        css_content = "body{font-family:sans-serif;padding:20px;background:#f5f5f7;color:#1d1d1f;}"

    # 读取 JS 模块（按依赖顺序）
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
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <div class="icon">H</div>
    <span>Hermes</span>
  </div>
  <div class="sidebar-search">
    <input type="text" placeholder="搜索..." id="globalSearch">
  </div>
  <nav class="sidebar-nav">
    <div class="nav-section">
      <div class="nav-section-title">概览</div>
      <a class="nav-item active" data-page="dashboard"><span class="nav-icon">📊</span>仪表盘</a>
      <a class="nav-item" data-page="sessions"><span class="nav-icon">💬</span>会话</a>
      <a class="nav-item" data-page="tools"><span class="nav-icon">🔧</span>工具</a>
    </div>
    <div class="nav-section">
      <div class="nav-section-title">管理</div>
      <a class="nav-item" data-page="skills"><span class="nav-icon">⚡</span>技能</a>
      <a class="nav-item" data-page="memory"><span class="nav-icon">🧠</span>记忆</a>
      <a class="nav-item" data-page="cron"><span class="nav-icon">⏰</span>定时任务</a>
      <a class="nav-item" data-page="agents"><span class="nav-icon">🤖</span>子 Agent</a>
    </div>
    <div class="nav-section">
      <div class="nav-section-title">系统</div>
      <a class="nav-item" data-page="mcp"><span class="nav-icon">🔌</span>MCP 服务</a>
      <a class="nav-item" data-page="config"><span class="nav-icon">⚙️</span>配置</a>
    </div>
  </nav>
  <div class="sidebar-footer">
    <div class="status"><span class="status-dot"></span>运行中 · v{APP_VERSION}</div>
  </div>
</aside>
<div class="main">
  <header class="header">
    <span class="header-title" id="pageTitle">仪表盘</span>
    <div class="header-actions">
      <button class="btn btn-secondary" id="refreshBtn">↻ 刷新</button>
      <button class="btn btn-primary">＋ 新建</button>
    </div>
  </header>
  <div class="content" id="contentArea">
    <div class="page active" id="page-dashboard"><p>加载中...</p></div>
    <div class="page" id="page-sessions"></div>
    <div class="page" id="page-tools"></div>
    <div class="page" id="page-skills"></div>
    <div class="page" id="page-memory"></div>
    <div class="page" id="page-cron"></div>
    <div class="page" id="page-agents"></div>
    <div class="page" id="page-mcp"></div>
    <div class="page" id="page-config"></div>
  </div>
</div>
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

# 版本管理端点 - 挂载到 Gradio 内部 FastAPI
@demo.app.get("/api/version")
async def get_version():
    return {"version": APP_VERSION, "build_time": BUILD_TIME}

@demo.app.get("/api/health")
async def health():
    return {"status": "ok", "service": "hermes-mcp-space", "version": APP_VERSION}

logger.info(f"Hermes Agent MCP Space v{APP_VERSION} 初始化完成")

# HF Spaces Gradio SDK 需要显式启动
demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True)
