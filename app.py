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
import time
from datetime import datetime
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

APP_VERSION = os.environ.get("APP_VERSION", "4.6.1")
BUILD_TIME = os.environ.get("BUILD_TIME", datetime.now().strftime("%Y-%m-%d %H:%M"))
START_TIME = time.time()  # 进程启动时间戳


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
        "js/pages/dashboard.js", "js/pages/knowledge.js", "js/pages/sessions.js", "js/pages/chat.js",
        "js/pages/tools.js", "js/pages/skills.js", "js/pages/memory.js",
        "js/pages/plugins.js",
        "js/pages/cron.js", "js/pages/agents.js", "js/pages/config.js",
        "js/pages/about.js",
        "js/pages/trash.js",
        "js/pages/mcp.js", "js/pages/marketplace.js", "js/pages/logs.js",
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
        from starlette.responses import Response as StarletteResponse
        return StarletteResponse(
            content=full_html,
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )

    # Inject version/health/meta endpoints
    @app.get("/api/meta")
    async def get_meta():
        """统一的元数据端点：版本号、构建时间、运行时长等动态信息"""
        uptime = int(time.time() - START_TIME)
        hours, remainder = divmod(uptime, 3600)
        minutes, seconds = divmod(remainder, 60)
        return {
            "version": APP_VERSION,
            "build_time": BUILD_TIME,
            "uptime_seconds": uptime,
            "uptime_human": f"{hours}h {minutes}m {seconds}s" if hours else f"{minutes}m {seconds}s",
            "now": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    @app.get("/api/version")
    async def get_version():
        return {"version": APP_VERSION, "build_time": BUILD_TIME}

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "service": "hermes-mcp-space", "version": APP_VERSION}

    # Mount all backend API routers
    try:
        from backend.routers import (
            sessions, tools, skills, memory, cron, agents, mcp, config_api, dashboard, logs, events, plugins, trash, evals, stats, knowledge
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
        app.include_router(events.router)
        app.include_router(plugins.router)
        app.include_router(trash.router)
        app.include_router(evals.router, prefix="/api", tags=["evals"])
        app.include_router(stats.router, prefix="/api", tags=["stats"])
        app.include_router(knowledge.router)
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

    # Mount API docs (Swagger UI + ReDoc)
    try:
        from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
        from fastapi.openapi.utils import get_openapi

        @app.get("/docs", include_in_schema=False)
        async def custom_swagger_ui():
            return get_swagger_ui_html(
                openapi_url="/openapi.json",
                title="Hermes Agent API",
                swagger_favicon_url="",
            )

        @app.get("/redoc", include_in_schema=False)
        async def custom_redoc():
            return get_redoc_html(
                openapi_url="/openapi.json",
                title="Hermes Agent API",
            )

        @app.get("/openapi.json", include_in_schema=False)
        async def custom_openapi():
            return get_openapi(
                title="Hermes Agent API",
                version=APP_VERSION,
                routes=app.routes,
            )
        logger.info("API docs mounted (/docs + /redoc)")
    except Exception as e:
        logger.warning(f"Failed to mount API docs: {e}")

    logger.info("Custom routes injected into Gradio app")

    # Initialize seed data (demo data for first launch)
    try:
        from backend.seed_data import init_seed_data
        if init_seed_data():
            logger.info("Seed data initialized (first launch)")
        else:
            logger.info("Seed data already exists, skipped")
    except Exception as e:
        logger.warning(f"Failed to initialize seed data: {e}")

    # Start cron scheduler
    try:
        from backend.services.cron_scheduler import start_scheduler
        start_scheduler()
        logger.info("Cron scheduler started")
    except Exception as e:
        logger.warning(f"Failed to start cron scheduler: {e}")

    # Initialize MCP client service (gateway mode)
    try:
        from backend.services.mcp_client_service import mcp_client_service
        from backend.config import get_hermes_home
        mcp_config_path = get_hermes_home() / "mcp_servers.json"
        mcp_client_service.init(mcp_config_path)
        logger.info("MCP client service initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize MCP client service: {e}")

    # Add SSE event emit middleware
    try:
        from backend.middleware.events import EventEmitMiddleware
        app.add_middleware(EventEmitMiddleware)
        logger.info("Event emit middleware added")
    except Exception as e:
        logger.warning(f"Failed to add event middleware: {e}")

    return app

App.create_app = staticmethod(_patched_create_app)

# Create Gradio Blocks (HF Spaces SDK needs the `demo` variable)
with gr.Blocks(title="Hermes Agent MCP Space") as demo:
    gr.HTML("<!-- Hermes Agent MCP Space -->")

logger.info(f"Hermes Agent MCP Space v{APP_VERSION} initialized")

# HF Spaces Gradio SDK will call demo.launch() for us
if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True, ssr_mode=False)
