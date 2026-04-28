# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Space - 部署入口
策略：Monkey-patch Gradio 的 App.create_app，在创建 app 后立即注册自定义路由。
"""

# CRITICAL: Disable SSR mode before importing gradio
# HF Spaces enables SSR by default, which renders on port 7861 via Node.js
# and bypasses our custom routes on port 7860
import os
os.environ["GRADIO_SSR_MODE"] = "false"

import json
import logging
import re
from pathlib import Path
from fastapi import Request
from fastapi.responses import HTMLResponse

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("hermes-space")

APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
BUILD_TIME = os.environ.get("BUILD_TIME", "2026-04-28")


def load_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.warning(f"Failed to load {path}: {e}")
        return ""


def build_full_html():
    """Build a completely self-contained HTML page with all CSS and JS inlined."""
    frontend_dir = Path(__file__).resolve().parent / "frontend"

    css = load_file(frontend_dir / "css" / "style.css")

    js_files = [
        "js/api.js", "js/components.js",
        "js/pages/dashboard.js", "js/pages/sessions.js", "js/pages/chat.js",
        "js/pages/tools.js", "js/pages/skills.js", "js/pages/memory.js",
        "js/pages/cron.js", "js/pages/agents.js", "js/pages/config.js",
        "js/pages/mcp.js", "js/pages/logs.js",
        "js/app.js",
    ]

    all_js = ""
    for jsf in js_files:
        content = load_file(frontend_dir / jsf)
        if content:
            all_js += f"\n// === {jsf} ===\n{content}\n"

    index_html = load_file(frontend_dir / "index.html")

    # Replace CSS link with inline style
    html = index_html.replace(
        '<link rel="stylesheet" href="/css/style.css">',
        f'<style>\n{css}\n</style>'
    )

    # Remove all <script src=...> tags
    html = re.sub(r'<script\s+src="[^"]*"></script>', '', html)

    # Insert all JS inline before </body>
    html = html.replace('</body>', f'<script>\n{all_js}\n</script>\n</body>')

    return html


logger.info("Initializing Hermes Agent MCP Space...")

import gradio as gr
from gradio.routes import App

# Build the full HTML FIRST
full_html = build_full_html()
logger.info(f"Frontend HTML built ({len(full_html)} bytes)")

# Monkey-patch App.create_app to inject our custom routes after Gradio creates the app
_original_create_app = App.create_app

def _patched_create_app(blocks, **kwargs):
    app = _original_create_app(blocks, **kwargs)

    # Remove Gradio's default GET / route so ours takes priority
    for route in list(app.router.routes):
        if getattr(route, 'path', None) == "/" and getattr(route, 'methods', set()) == {"GET"}:
            app.router.routes.remove(route)
            logger.info("Removed default Gradio index route")

    # Inject custom HTML index
    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def custom_index(request: Request):
        return full_html

    # Inject version/health endpoints
    @app.get("/api/version")
    async def get_version():
        return {"version": APP_VERSION, "build_time": BUILD_TIME}

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "service": "hermes-mcp-space", "version": APP_VERSION}

    # Mount all backend API routers
    try:
        from backend.routers import (
            sessions, tools, skills, memory, cron, agents, mcp, config_api, dashboard, logs
        )
        app.include_router(sessions.router)
        app.include_router(tools.router)
        app.include_router(skills.router)
        app.include_router(memory.router)
        app.include_router(cron.router)
        app.include_router(agents.router)
        app.include_router(mcp.router)
        app.include_router(config_api.router)
        app.include_router(dashboard.router)
        app.include_router(logs.router)
        logger.info("Backend API routers mounted successfully")
    except Exception as e:
        logger.warning(f"Failed to mount backend API routers: {e}")

    # Mount MCP server (manual implementation - Streamable HTTP + SSE)
    try:
        from backend.mcp_server import router as mcp_router
        app.include_router(mcp_router)
        logger.info("MCP server routes mounted (/mcp + /sse)")
    except Exception as e:
        logger.warning(f"Failed to mount MCP server: {e}")

    logger.info("Custom routes injected into Gradio app")
    return app

App.create_app = staticmethod(_patched_create_app)

# Create Gradio Blocks (HF Spaces SDK needs the `demo` variable)
with gr.Blocks(title="Hermes Agent MCP Space") as demo:
    gr.HTML("<!-- Hermes Agent MCP Space -->")

logger.info(f"Hermes Agent MCP Space v{APP_VERSION} initialized")

# HF Spaces Gradio SDK will call demo.launch() for us
if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True, ssr_mode=False)
