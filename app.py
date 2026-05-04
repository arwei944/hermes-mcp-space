from backend.version import __version__ as _APP_VERSION
# -*- coding: utf-8 -*-
"""Hermes Agent MCP Space - 部署入口"""

import os
os.environ["GRADIO_SSR_MODE"] = "false"
os.environ["TZ"] = "Asia/Shanghai"

import json, logging, re, subprocess, time
from datetime import datetime
from pathlib import Path
from fastapi import Request
from fastapi.responses import HTMLResponse

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format="[%(asctime)s] %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
logger = logging.getLogger("hermes-space")
APP_VERSION = os.environ.get("APP_VERSION", _APP_VERSION)
BUILD_TIME = os.environ.get("BUILD_TIME", datetime.now().strftime("%Y-%m-%d %H:%M"))
START_TIME = time.time()

def load_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f: return f.read()
    except FileNotFoundError: return ""

_CHANGELOG_INLINE = None
def _get_changelog_json():
    global _CHANGELOG_INLINE
    if _CHANGELOG_INLINE is not None: return _CHANGELOG_INLINE
    try:
        import subprocess as _sp
        _tags = _sp.run(["git", "tag", "-l", "v*"], capture_output=True, text=True, timeout=5).stdout.strip().split('\n')
        _tags = [t.strip() for t in _tags if t.strip()]
        _tags.sort(key=lambda t: [int(x) for x in t.replace('v', '').split('.')], reverse=True)
        _entries = []
        for _tag in _tags[:20]:
            _msg = _sp.run(["git", "log", "-1", "--format=%s%n%b", _tag], capture_output=True, text=True, timeout=5).stdout.strip()
            _date = _sp.run(["git", "log", "-1", "--format=%ci", _tag], capture_output=True, text=True, timeout=5).stdout.strip()[:16]
            _lines = _msg.split('\n')
            _entries.append({"version": _tag, "date": _date, "title": _lines[0] if _lines else _tag, "changes": [l.strip().lstrip('-* ') for l in _lines[1:] if l.strip()] or [_msg]})
        if _entries: _CHANGELOG_INLINE = json.dumps(_entries, ensure_ascii=False); return _CHANGELOG_INLINE
    except Exception: pass
    _CHANGELOG_INLINE = "[]"
    return _CHANGELOG_INLINE

def _get_build_version() -> str:
    try:
        result = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, timeout=5, cwd=Path(__file__).resolve().parent)
        if result.returncode == 0: return result.stdout.strip()
    except Exception: pass
    return "unknown"

def _get_cache_dir() -> Path:
    try:
        from backend.config import get_hermes_home
        cache_dir = get_hermes_home() / "cache"
    except ImportError: cache_dir = Path.home() / ".hermes" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir

def _save_build_cache(html: str) -> None:
    try: (_get_cache_dir() / "last_good_html.html").write_text(html, encoding="utf-8")
    except Exception as e: logger.warning(f"保存构建缓存失败: {e}")

def _load_build_cache() -> str:
    try:
        cache_path = _get_cache_dir() / "last_good_html.html"
        if cache_path.exists(): return cache_path.read_text(encoding="utf-8")
    except Exception: pass
    return ""

def _validate_build(html: str) -> list:
    warnings = []
    script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
    if not script_match: warnings.append("构建验证: 未找到 <script> 标签"); return warnings
    js_content = script_match.group(1)
    ext_css = re.findall(r'<link[^>]+href=["\']https?://[^"\']+\.css["\']', html)
    if ext_css: warnings.append(f"构建验证: 发现 {len(ext_css)} 个外部 CSS 链接残留")
    ext_js = re.findall(r'<script[^>]+src=["\']https?://[^"\']+\.js["\']', html)
    if ext_js: warnings.append(f"构建验证: 发现 {len(ext_js)} 个外部 JS 链接残留")
    import_lines = [l.strip() for l in js_content.split('\n') if l.strip().startswith('import ') and ' from ' in l.strip()]
    if import_lines: warnings.append(f"构建验证: 发现 {len(import_lines)} 行 import 语句残留")
    export_lines = [l.strip() for l in js_content.split('\n') if l.strip().startswith('export ')]
    if export_lines: warnings.append(f"构建验证: 发现 {len(export_lines)} 行 export 语句残留")
    for line in js_content.split('\n'):
        stripped = line.strip()
        if stripped.startswith(('//', '*', '/*')): continue
        if re.match(r'^\s*(const|let)\s+\w+', line):
            warnings.append(f"构建验证: 发现 const/let 残留: {stripped[:60]}"); break
    required_globals = ["SSEManager", "Components", "API", "Store", "Bus", "Router"]
    for var in required_globals:
        if not re.search(rf'(?:var\s+{var}\s*=|window\.{var}\s*=)', js_content):
            warnings.append(f"构建验证: 关键全局变量 '{var}' 未定义")
    return warnings

def build_full_html():
    frontend_dir = Path(__file__).resolve().parent / "frontend"
    css_files = ["css/style.css", "css/dark-theme.css", "css/knowledge.css"]
    all_css = ""
    for css_path in css_files:
        css_content = load_file(frontend_dir / css_path)
        if css_content: all_css += f"/* === {css_path} === */\n{css_content}\n\n"
    js_base = frontend_dir / "js"
    def _scan_dir(rel_dir, exclude=None):
        exclude = exclude or set()
        d = js_base / rel_dir
        if not d.exists(): return []
        return [f"js/{rel_dir}/{jsf.name}" for jsf in sorted(d.glob("*.js")) if jsf.name not in exclude]
    core_order = ["Logger.js", "Store.js", "Bus.js", "ErrorHandler.js", "APIClient.js", "constants.js", "Router.js", "init.js"]
    core_js = [f"js/core/{f}" for f in core_order]
    for extra in _scan_dir("core", exclude=set(core_order)):
        if extra not in core_js: core_js.append(extra)
    core_js.extend(_scan_dir("constants"))
    core_js.append("js/api.js")
    comp_all = _scan_dir("components")
    comp_index = [f for f in comp_all if f.endswith("/index.js")]
    comp_rest = [f for f in comp_all if not f.endswith("/index.js")]
    core_js.extend(comp_rest + comp_index)
    core_js.extend(_scan_dir("services"))
    core_js.extend(_scan_dir("utils"))
    pages_dir = frontend_dir / "js" / "pages"
    page_files = []
    for item in sorted(pages_dir.iterdir()):
        if item.is_file() and item.suffix == '.js': page_files.append(f"js/pages/{item.name}")
        elif item.is_dir():
            for jsf in sorted(item.glob("*.js")): page_files.append(f"js/pages/{item.name}/{jsf.name}")
    app_js = ["js/app.js"]
    js_files = core_js + page_files + app_js
    _changelog_json = _get_changelog_json()
    all_js_parts = []
    for jsf in js_files:
        content = load_file(frontend_dir / jsf)
        if not content: continue
        parts = jsf.rsplit('/', 1)
        file_dir = parts[0] if len(parts) > 1 else ""
        lines = content.split('\n')
        export_stmts = []
        result_lines = []
        def _resolve_import_path(rel_path): return os.path.normpath(file_dir + '/' + rel_path)
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("export default "): export_stmts.append(f"window.__m = window.__m || {{}}; window.__m['{jsf}'] = {stripped[len('export default '):]};"); continue
            if stripped.startswith("export {") and stripped.endswith("};"): export_stmts.append(f"window.__m = window.__m || {{}}; window.__m['{jsf}'] = {{ {stripped[len('export {'):-2].strip()} }};"); continue
            if (stripped.startswith("import ") and " from " in stripped and stripped.endswith(";")) or (stripped.startswith("import {") and " from " in stripped and stripped.endswith(";")): continue
            line = re.sub(r"\(?\s*await\s+import\(['"]([^.?/][^'"]+)['"]\)\s*\)?\s*\.default", lambda m: "window.__m['" + _resolve_import_path(m.group(1)) + "']", line)
            line = re.sub(r"await\s+import\(['"]([^.?/][^'"]+)['"]\)\)\.default", lambda m: "window.__m['" + _resolve_import_path(m.group(1)) + "']", line)
            line = re.sub(r"\(?\s*await\s+import\(['"]([^.?/][^'"]+)['"]\)\s*\)?", lambda m: "window.__m['" + _resolve_import_path(m.group(1)) + "']", line)
            line = re.sub(r'^(\s*)const\s+', r'\1var ', line)
            line = re.sub(r'^(\s*)let\s+', r'\1var ', line)
            result_lines.append(line)
        file_js = '\n'.join(result_lines)
        if export_stmts: file_js += '\n' + '\n'.join(export_stmts) + '\n'
        all_js_parts.append(f"\n// === {jsf} ===\ntry {{\n{file_js}}} catch(_fileErr) {{ console.warn('[build] {jsf}:', _fileErr); }}\n")
    all_js = '\n'.join(all_js_parts)
    build_commit = _get_build_version()
    build_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    all_js = f"window.__BUILD_VERSION__ = '{build_commit}';\nwindow.__BUILD_TIME__ = '{build_time_str}';\nwindow.__CHANGELOG_DATA__ = {_changelog_json};\n" + all_js
    index_html = load_file(frontend_dir / "index.html")
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="[^"]*\.css"[^>]*>', '', index_html)
    html = html.replace('</head>', f'<style>\n{all_css}\n</style>\n</head>')
    html = re.sub(r'<script\s+[^>]*src="[^"]*"[^>]*></script>', '', html)
    html = html.replace('</body>', f'<script>\n{all_js}\n</script>\n</body>')
    build_warnings = _validate_build(html)
    for w in build_warnings: logger.warning(w)
    return html

logger.info("Initializing Hermes Agent MCP Space...")
import gradio as gr
from gradio.routes import App

_build_error = None
try:
    full_html = build_full_html()
    logger.info(f"Frontend HTML built ({len(full_html)} bytes)")
    _save_build_cache(full_html)
except Exception as e:
    _build_error = f"{type(e).__name__}: {e}"
    logger.error(f"build_full_html failed: {_build_error}")
    cached_html = _load_build_cache()
    if cached_html: full_html = cached_html
    else:
        frontend_dir = Path(__file__).resolve().parent / "frontend"
        full_html = load_file(frontend_dir / "index.html")

_original_create_app = App.create_app
def _patched_create_app(blocks, **kwargs):
    app = _original_create_app(blocks, **kwargs)
    for route in list(app.router.routes):
        if getattr(route, 'path', None) == "/" and getattr(route, 'methods', set()) == {"GET"}: app.router.routes.remove(route)
    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def custom_index(request: Request):
        from starlette.responses import Response as StarletteResponse
        return StarletteResponse(content=full_html, media_type="text/html", headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})
    @app.get("/api/meta")
    async def get_meta():
        uptime = int(time.time() - START_TIME)
        hours, remainder = divmod(uptime, 3600)
        minutes, seconds = divmod(remainder, 60)
        return {"version": APP_VERSION, "build_time": BUILD_TIME, "uptime_seconds": uptime, "uptime_human": f"{hours}h {minutes}m {seconds}s" if hours else f"{minutes}m {seconds}s", "now": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
    @app.get("/api/version")
    async def get_version(): return {"version": APP_VERSION, "build_time": BUILD_TIME}
    @app.get("/api/health")
    async def health(): return {"status": "healthy", "service": "hermes-mcp-space", "version": APP_VERSION}
    try:
        from backend.routers import (sessions, tools, skills, memory, cron, agents, mcp, config_api, dashboard, logs, events, plugins, trash, evals, stats, knowledge, screenshot, persistence, version, ops, frontend_errors)
        for r in [sessions, tools, skills, memory, cron, agents, mcp, config_api, dashboard, logs, events, plugins, trash, evals, stats, knowledge, screenshot, persistence, version, ops, frontend_errors]: app.include_router(r.router)
        try:
            from backend.routers.agents_api import router as agents_api_router
            app.include_router(agents_api_router)
        except Exception: pass
        logger.info("Backend API routers mounted successfully")
    except Exception as e: logger.warning(f"Failed to mount backend API routers: {e}")
    try:
        from backend.mcp_server import router as mcp_router
        app.include_router(mcp_router)
        logger.info("MCP server routes mounted")
    except Exception as e: logger.warning(f"Failed to mount MCP server: {e}")
    try:
        from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
        from fastapi.openapi.utils import get_openapi
        @app.get("/docs", include_in_schema=False)
        async def custom_swagger_ui(): return get_swagger_ui_html(openapi_url="/openapi.json", title="Hermes Agent API")
        @app.get("/redoc", include_in_schema=False)
        async def custom_redoc(): return get_redoc_html(openapi_url="/openapi.json", title="Hermes Agent API")
        @app.get("/openapi.json", include_in_schema=False)
        async def custom_openapi(): return get_openapi(title="Hermes Agent API", version=APP_VERSION, routes=app.routes)
    except Exception as e: logger.warning(f"Failed to mount API docs: {e}")
    # Initialize knowledge database
    try:
        from backend.db import get_knowledge_db, init_knowledge_db
        init_knowledge_db(get_knowledge_db())
    except Exception as e: logger.warning(f"Failed to initialize knowledge database: {e}")
    # Initialize review scheduler
    try:
        from backend.services.review_scheduler import review_scheduler
        review_scheduler.init()
    except Exception as e: logger.warning(f"Failed to initialize review scheduler: {e}")
    # Register evolution cron jobs
    try:
        from backend.services.cron_service import cron_service
        evolution_jobs = [
            {"name": "auto_chain", "schedule": "*/30 * * * *", "command": "curl -s -X POST http://localhost:7860/api/knowledge/auto-chain"},
            {"name": "knowledge_extract", "schedule": "0 * * * *", "command": "curl -s -X POST http://localhost:7860/api/knowledge/auto-extract"},
            {"name": "daily_evolution", "schedule": "0 3 * * *", "command": "curl -s -X POST http://localhost:7860/api/evolution/daily"},
            {"name": "full_learning", "schedule": "0 2 * * *", "command": "curl -s -X POST http://localhost:7860/api/knowledge/auto-learn"},
            {"name": "refresh_mcp", "schedule": "*/10 * * * *", "command": "curl -s -X POST http://localhost:7860/api/mcp/refresh"},
            {"name": "trash_cleanup", "schedule": "0 4 * * 0", "command": "curl -s -X POST http://localhost:7860/api/trash/auto-cleanup"},
            {"name": "compat_sync", "schedule": "0 4 * * *", "command": "curl -s -X POST http://localhost:7860/api/compat/auto-sync"},
            {"name": "weekly_skill_eval", "schedule": "0 5 * * 0", "command": "curl -s -X POST http://localhost:7860/api/skills/auto-eval-optimize"},
        ]
        existing_jobs = {j.get("name") for j in cron_service.list_cron_jobs()}
        for job_def in evolution_jobs:
            if job_def["name"] not in existing_jobs: cron_service.create_cron_job({**job_def, "enabled": True})
        logger.info(f"Evolution cron jobs registered ({len(evolution_jobs)} total)")
    except Exception as e: logger.warning(f"Failed to register evolution cron jobs: {e}")
    # Initialize persistence manager
    try:
        from backend.services.persistence_manager import persistence_manager
        init_result = persistence_manager.initialize()
        restore_result = persistence_manager.restore_on_startup()
        logger.info(f"Persistence: {init_result}, Restore: {restore_result.get('message', 'skipped')}")
    except Exception as e: logger.warning(f"Failed to initialize persistence: {e}")
    # Data integrity check
    try:
        from backend.services.data_integrity import data_integrity_checker
        report = data_integrity_checker.run_full_check(auto_fix=True)
        summary = report.get("summary", {})
        logger.info(f"Data integrity: {summary.get('status')} ({summary.get('total_checks')} checks, {summary.get('total_errors')} issues)")
    except Exception as e: logger.warning(f"Data integrity check failed: {e}")
    # Seed data
    try:
        from backend.seed_data import init_seed_data
        if init_seed_data(): logger.info("Seed data initialized")
    except Exception as e: logger.warning(f"Failed to initialize seed data: {e}")
    # Start cron scheduler
    try:
        from backend.services.cron_scheduler import start_scheduler
        start_scheduler()
    except Exception as e: logger.warning(f"Failed to start cron scheduler: {e}")
    # Session lifecycle cleanup
    try:
        from backend.services.session_lifecycle import session_lifecycle
        session_lifecycle.start_cleanup_thread()
        logger.info("Session lifecycle cleanup thread started")
    except Exception as e: logger.warning(f"Failed to start session lifecycle: {e}")
    # EventBus handlers
    try:
        from backend.events.handlers import register_event_handlers
        handler_count = register_event_handlers()
        logger.info(f"EventBus handlers registered: {handler_count}")
    except Exception as e: logger.warning(f"Failed to register event handlers: {e}")
    # MCP client service
    try:
        from backend.services.mcp_client_service import mcp_client_service
        from backend.config import get_hermes_home
        mcp_client_service.init(get_hermes_home() / "mcp_servers.json")
    except Exception as e: logger.warning(f"Failed to initialize MCP client service: {e}")
    # Middlewares
    try:
        from backend.middleware.events import EventEmitMiddleware
        app.add_middleware(EventEmitMiddleware)
    except Exception as e: logger.warning(f"Failed to add event middleware: {e}")
    try:
        from backend.middleware.error_tracker import ErrorTrackerMiddleware
        app.add_middleware(ErrorTrackerMiddleware)
    except Exception as e: logger.warning(f"Failed to add error tracker: {e}")
    # Ops Protocol
    try:
        from ops_agent import OpsClient
        ops_client = OpsClient(server="https://arwei944-ops-center.hf.space", project_id="hermes-mcp-space", project_name="Hermes Agent MCP Space", project_url="https://arwei944-hermes-mcp-space.hf.space", project_type="hf_docker", version=APP_VERSION, environment="production", heartbeat_interval=120)
        ops_client.start()
        ops_client.emit_event("deploy", level="info", message=f"Hermes v{APP_VERSION} started")
    except Exception as e: logger.warning(f"Ops Protocol init failed: {e}")
    return app

App.create_app = staticmethod(_patched_create_app)

with gr.Blocks(title="Hermes Agent MCP Space") as demo:
    gr.HTML("<!-- Hermes Agent MCP Space -->")

logger.info(f"Hermes Agent MCP Space v{APP_VERSION} initialized")

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True, ssr_mode=False)