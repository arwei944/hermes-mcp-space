from backend.version import __version__ as _APP_VERSION
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
os.environ["TZ"] = "Asia/Shanghai"

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

APP_VERSION = os.environ.get("APP_VERSION", _APP_VERSION)
BUILD_TIME = os.environ.get("BUILD_TIME", datetime.now().strftime("%Y-%m-%d %H:%M"))
START_TIME = time.time()  # 进程启动时间戳


def load_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        logger.error(f"CRITICAL: Frontend file not found: {path}")
        raise RuntimeError(f"Frontend file missing: {path}") from None
    except Exception as e:
        logger.error(f"CRITICAL: Failed to load {path}: {e}")
        raise RuntimeError(f"Failed to load frontend file: {path}") from None


def build_full_html():
    """Build a completely self-contained HTML page with all CSS and JS inlined."""
    frontend_dir = Path(__file__).resolve().parent / "frontend"

    # Load ALL CSS files and inline them
    css_files = ["css/style.css", "css/dark-theme.css", "css/knowledge.css"]
    all_css = ""
    for css_path in css_files:
        css_content = load_file(frontend_dir / css_path)
        if css_content:
            all_css += f"/* === {css_path} === */\n{css_content}\n\n"

    # 自动扫描 JS 文件（支持子目录结构：优先 register.js，否则 *.js）
    core_js = ["js/core/Logger.js", "js/core/Store.js", "js/core/Bus.js",
               "js/core/ErrorHandler.js", "js/core/APIClient.js", "js/core/constants.js",
               "js/core/Router.js", "js/core/init.js", "js/api.js"]
    # Components V2 目录结构：按依赖顺序加载子模块
    components_dir = frontend_dir / "js" / "components"
    components_register = components_dir / "register.js"
    if components_register.exists():
        # register.js 存在时，按 register.js 中的顺序加载（register.js 本身只是注释说明）
        # 实际加载顺序：icons → utils → feedback → layout → form → data-display → index
        component_files = [
            "js/components/icons.js",
            "js/components/utils.js",
            "js/components/feedback.js",
            "js/components/layout.js",
            "js/components/form.js",
            "js/components/data-display.js",
            "js/components/index.js",
        ]
        core_js.extend(component_files)
    else:
        # 回退：扫描 components 目录下所有 .js 文件
        for jsf in sorted(components_dir.glob("*.js")):
            core_js.append(f"js/components/{jsf.name}")
    # V2 Services
    services_dir = frontend_dir / "js" / "services"
    if services_dir.exists():
        for jsf in sorted(services_dir.glob("*.js")):
            core_js.append(f"js/services/{jsf.name}")
    # Utility files (SSEManager, confirm-dialog, charts, etc.)
    utils_dir = frontend_dir / "js" / "utils"
    if utils_dir.exists():
        for jsf in sorted(utils_dir.glob("*.js")):
            core_js.append(f"js/utils/{jsf.name}")
    pages_dir = frontend_dir / "js" / "pages"
    page_files = []
    for item in sorted(pages_dir.iterdir()):
        if item.is_file() and item.suffix == '.js':
            # 旧式单文件页面
            page_files.append(f"js/pages/{item.name}")
        elif item.is_dir():
            # V2 目录结构：加载所有 .js 文件（import() 需要子模块在同一个 module 中）
            for jsf in sorted(item.glob("*.js")):
                page_files.append(f"js/pages/{item.name}/{jsf.name}")
    app_js = ["js/app.js"]
    js_files = core_js + page_files + app_js

    logger.info(f"Auto-discovered {len(page_files)} page files: {[f.split('/')[-1] for f in page_files]}")

    # In build_full_html mode, all JS is inlined into a single <script> tag.
    # Strategy: transform ES module syntax to plain JS, with each file wrapped
    # in try-catch for isolation.
    #
    # Transformations:
    #   1. `export default X` → append `window.__m['dir/file.js'] = X;`
    #   2. `export { A, B }` → append `window.__m['dir/file.js'] = { A, B };`
    #   3. `import X from './Y.js'` → remove (X is already in scope via var)
    #   4. `import { A, B } from './C.js'` → remove (same reason)
    #   5. `(await) import('./X.js').default` → `window.__m['dir/X.js']`
    #   6. `(await) import('./X.js')` → `window.__m['dir/X.js']`
    #   7. `const`/`let` → `var` (allow redeclaration in shared scope)

    all_js_parts = []  # Final assembled JS parts

    for jsf in js_files:
        content = load_file(frontend_dir / jsf)
        if not content:
            continue

        # Determine directory for resolving relative imports
        parts = jsf.rsplit('/', 1)
        file_dir = parts[0] if len(parts) > 1 else ""

        lines = content.split('\n')
        export_stmts = []  # Collected export registrations for this file
        result_lines = []

        for line in lines:
            stripped = line.strip()

            # 1. export default X → collect for end-of-file registration
            if stripped.startswith("export default "):
                val = stripped[len("export default "):]
                export_stmts.append(
                    f"window.__m = window.__m || {{}}; window.__m['{jsf}'] = {val};"
                )
                continue

            # 2. export { A, B } → collect for end-of-file registration
            if stripped.startswith("export {") and stripped.endswith("};"):
                names = stripped[len("export {"):-2].strip()
                export_stmts.append(
                    f"window.__m = window.__m || {{}}; window.__m['{jsf}'] = {{ {names} }};"
                )
                continue

            # 3. import X from './Y.js' → remove (var X is already in scope)
            if stripped.startswith("import ") and " from " in stripped and stripped.endswith(";"):
                continue

            # 4. import { A, B } from './C.js' → remove
            if stripped.startswith("import {") and " from " in stripped and stripped.endswith(";"):
                continue

            # 5. (await) import('./X.js').default → window.__m['dir/X.js']
            line = re.sub(
                r"\(?\s*await\s+import\(['\"]\.\/([^'\"]+)['\"]\)\s*\)?\s*\.default",
                f"window.__m['{file_dir}/\\1']",
                line
            )
            # Also handle: var X = (await import('./X.js')).default;
            line = re.sub(
                r"await\s+import\(['\"]\.\/([^'\"]+)['\"]\)\)\.default",
                f"window.__m['{file_dir}/\\1']",
                line
            )
            # Handle: import('./X.js').then(m => m.default.render(...))
            line = re.sub(
                r"import\(['\"]\.\/([^'\"]+)['\"]\)\.then\(m\s*=>\s*m\.default\.(\w+)\(([^)]*)\)\)",
                r"(function(){ var _m = window.__m && window.__m['" + file_dir + r"/\1']; if(_m && _m.default) _m.default.\2(\3); })()",
                line
            )

            # 6. (await) import('./X.js') → window.__m['dir/X.js']
            line = re.sub(
                r"\(?\s*await\s+import\(['\"]\.\/([^'\"]+)['\"]\)\s*\)?",
                f"window.__m['{file_dir}/\\1']",
                line
            )

            # 7. const/let → var
            line = re.sub(r'^(\s*)const\s+', r'\1var ', line)
            line = re.sub(r'^(\s*)let\s+', r'\1var ', line)

            result_lines.append(line)

        # Assemble: file content + export registrations at the end
        file_js = '\n'.join(result_lines)
        if export_stmts:
            file_js += '\n' + '\n'.join(export_stmts) + '\n'

        # Wrap in try-catch for isolation
        all_js_parts.append(
            f"\n// === {jsf} ===\n"
            f"try {{\n{file_js}}} catch(_fileErr) {{ console.warn('[build] {jsf}:', _fileErr); }}\n"
        )

    all_js = '\n'.join(all_js_parts)

    index_html = load_file(frontend_dir / "index.html")

    # Replace CSS link with inline style (all CSS files combined)
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="[^"]*\.css"[^>]*>', '', html)
    html = html.replace('</head>', f'<style>\n{all_css}\n</style>\n</head>')

    # Remove all <script src=...> tags (with optional attributes like defer, type, etc.)
    html = re.sub(r'<script\s+[^>]*src="[^"]*"[^>]*></script>', '', html)

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
            content=full_html, media_type="text/html",
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
        return {"status": "healthy", "service": "hermes-mcp-space", "version": APP_VERSION}

    # Mount all backend API routers
    try:
        from backend.routers import (
            sessions, tools, skills, memory, cron, agents, mcp, config_api,
            dashboard, logs, events, plugins, trash, evals, stats, knowledge,
            screenshot, persistence, version, ops
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
        app.include_router(screenshot.router)
        app.include_router(persistence.router)
        app.include_router(version.router)
        app.include_router(ops.router)
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
                openapi_url="/openapi.json", title="Hermes Agent API", swagger_favicon_url="",
            )
        @app.get("/redoc", include_in_schema=False)
        async def custom_redoc():
            return get_redoc_html(openapi_url="/openapi.json", title="Hermes Agent API")
        @app.get("/openapi.json", include_in_schema=False)
        async def custom_openapi():
            return get_openapi(title="Hermes Agent API", version=APP_VERSION, routes=app.routes)
        logger.info("API docs mounted (/docs + /redoc)")
    except Exception as e:
        logger.warning(f"Failed to mount API docs: {e}")

    logger.info("Custom routes injected into Gradio app")

    # Initialize persistence manager (data backup/restore)
    try:
        from backend.services.persistence_manager import persistence_manager
        init_result = persistence_manager.initialize()
        logger.info(f"Persistence manager initialized: {init_result}")
        # Restore data from persistence backend on startup
        restore_result = persistence_manager.restore_on_startup()
        msg = restore_result.get("message", "skipped")
        logger.info(f"Startup restore: {msg}")
    except Exception as e:
        logger.warning(f"Failed to initialize persistence manager: {e}")

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
