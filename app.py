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
import time; time.tzset()  # 让 datetime.now() 使用北京时间
# 持久化存储：将 HERMES_HOME 指向 HF Storage Bucket 挂载点
if os.path.exists("/data") and not os.environ.get("HERMES_HOME"):
    os.environ["HERMES_HOME"] = "/data/hermes"

import json
import logging
import re
import subprocess
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
        logger.warning(f"Frontend file not found: {path}")
        return ""

# Changelog data - auto-generated from git tags
# Regenerate: python3 -c "import subprocess,json; tags=subprocess.run(['git','tag','-l','v*'],capture_output=True,text=True).stdout.strip().split('\n'); tags.sort(key=lambda t:[int(x) for x in t.replace('v','').split('.')],reverse=True); entries=[]; [entries.append({'version':t,'date':subprocess.run(['git','log','-1','--format=%ci',t],capture_output=True,text=True).stdout.strip()[:16],'title':subprocess.run(['git','log','-1','--format=%s',t],capture_output=True,text=True).stdout.strip(),'changes':[l.strip().lstrip('-* ') for l in subprocess.run(['git','log','-1','--format=%b',t],capture_output=True,text=True).stdout.strip().split('\n') if l.strip()]}) for t in tags[:20] if t.strip()]; open('backend/data/changelog.py','w').write('# Auto-generated\nCHANGELOG_FALLBACK='+json.dumps(entries,ensure_ascii=False,indent=2)+'\n')"
_CHANGELOG_INLINE = None  # Will be loaded on first use


def _get_changelog_json():
    """Get changelog data as JSON string, trying multiple sources."""
    global _CHANGELOG_INLINE
    if _CHANGELOG_INLINE is not None:
        return _CHANGELOG_INLINE

    # 1. Try git tags (dev environment)
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
            _title = _lines[0] if _lines else _tag
            _changes = [l.strip().lstrip('-* ') for l in _lines[1:] if l.strip()]
            _entries.append({"version": _tag, "date": _date, "title": _title, "changes": _changes if _changes else [_msg]})
        if _entries:
            _CHANGELOG_INLINE = json.dumps(_entries, ensure_ascii=False)
            return _CHANGELOG_INLINE
    except Exception:
        pass

    # 2. Try loading from backend/data/changelog.py via importlib
    try:
        import importlib.util as _ilu
        _paths_to_try = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "data", "changelog.py"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", "data", "changelog.py"),
        ]
        for _cl_path in _paths_to_try:
            if os.path.exists(_cl_path):
                _spec = _ilu.spec_from_file_location("changelog_data", _cl_path)
                _mod = _ilu.module_from_spec(_spec)
                _spec.loader.exec_module(_mod)
                _data = getattr(_mod, "CHANGELOG_FALLBACK", [])
                if _data:
                    _CHANGELOG_INLINE = json.dumps(_data, ensure_ascii=False)
                    logger.info(f"Loaded changelog from {_cl_path}: {len(_data)} versions")
                    return _CHANGELOG_INLINE
    except Exception as _e:
        logger.debug(f"importlib changelog failed: {_e}")

    # 3. Try from package import
    try:
        from backend.data.changelog import CHANGELOG_FALLBACK
        if CHANGELOG_FALLBACK:
            _CHANGELOG_INLINE = json.dumps(CHANGELOG_FALLBACK, ensure_ascii=False)
            return _CHANGELOG_INLINE
    except Exception:
        pass

    # 4. Empty fallback
    _CHANGELOG_INLINE = "[]"
    return _CHANGELOG_INLINE


def _get_build_version() -> str:
    """获取 git short commit hash 作为构建版本号"""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5,
            cwd=Path(__file__).resolve().parent,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return "unknown"


def _get_cache_dir() -> Path:
    """获取构建缓存目录"""
    try:
        from backend.config import get_hermes_home
        cache_dir = get_hermes_home() / "cache"
    except ImportError:
        cache_dir = Path.home() / ".hermes" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def _save_build_cache(html: str) -> None:
    """保存构建结果到缓存"""
    try:
        cache_path = _get_cache_dir() / "last_good_html.html"
        cache_path.write_text(html, encoding="utf-8")
        logger.info(f"构建缓存已保存 ({len(html)} bytes)")
    except Exception as e:
        logger.warning(f"保存构建缓存失败: {e}")


def _load_build_cache() -> str:
    """从缓存加载上一次成功的构建结果"""
    try:
        cache_path = _get_cache_dir() / "last_good_html.html"
        if cache_path.exists():
            html = cache_path.read_text(encoding="utf-8")
            logger.info(f"从构建缓存恢复 ({len(html)} bytes)")
            return html
    except Exception as e:
        logger.warning(f"加载构建缓存失败: {e}")
    return ""


def _validate_build(html: str) -> list:
    """验证构建产物的完整性，返回警告列表

    检查项：
    - 无外部 CSS/JS 链接残留
    - 无 import/export 语句残留
    - 无 const/let 关键字残留
    - __m key 一致性（无缺失导出）
    - __m key 无前导空格
    - 关键全局变量存在
    """
    warnings = []

    # 提取 <script> 内容
    script_match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
    if not script_match:
        warnings.append("构建验证: 未找到 <script> 标签")
        return warnings

    js_content = script_match.group(1)

    # 1. 检查外部 CSS/JS 链接残留
    ext_css = re.findall(r'<link[^>]+href=["\']https?://[^"\']+\.css["\']', html)
    if ext_css:
        warnings.append(f"构建验证: 发现 {len(ext_css)} 个外部 CSS 链接残留")

    ext_js = re.findall(r'<script[^>]+src=["\']https?://[^"\']+\.js["\']', html)
    if ext_js:
        warnings.append(f"构建验证: 发现 {len(ext_js)} 个外部 JS 链接残留")

    # 2. 检查 import/export 语句残留
    import_lines = [l.strip() for l in js_content.split('\n')
                    if l.strip().startswith('import ') and ' from ' in l.strip()]
    if import_lines:
        warnings.append(f"构建验证: 发现 {len(import_lines)} 行 import 语句残留")

    export_lines = [l.strip() for l in js_content.split('\n')
                    if l.strip().startswith('export ')]
    if export_lines:
        warnings.append(f"构建验证: 发现 {len(export_lines)} 行 export 语句残留")

    # 3. 检查 const/let 关键字残留（排除注释和字符串中的）
    for line in js_content.split('\n'):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        if re.match(r'^\s*(const|let)\s+\w+', line):
            warnings.append(f"构建验证: 发现 const/let 残留: {stripped[:60]}")
            break  # 只报告第一个

    # 4. __m key 一致性检查
    # 收集所有 __m 的赋值 key
    assigned_keys = set(re.findall(r"window\.__m\[['\"]([^'\"]+)['\"]\]\s*=", js_content))
    # 收集所有 __m 的读取 key
    read_keys = set(re.findall(r"window\.__m\[['\"]([^'\"]+)['\"]\]", js_content))
    # 读取但未赋值的 key（排除 .default 和 .then 等属性访问）
    missing_keys = read_keys - assigned_keys
    if missing_keys:
        warnings.append(f"构建验证: {len(missing_keys)} 个 __m key 缺失导出: {list(missing_keys)[:5]}")

    # 5. __m key 无前导空格
    leading_space_keys = re.findall(r"window\.__m\[['\"]\s+([^'\"]+)['\"]\]", js_content)
    if leading_space_keys:
        warnings.append(f"构建验证: {len(leading_space_keys)} 个 __m key 有前导空格: {leading_space_keys[:3]}")

    # 6. 关键全局变量存在性检查
    required_globals = ["SSEManager", "Components", "API", "Store", "Bus", "Router", "HermesClient", "CardOverlay", "StatusBar", "Dock", "SpotlightSearch", "ContextMenuManager", "SkeletonLoader"]
    for var in required_globals:
        # 检查是否有 var XXX = 或 window.XXX = 的定义
        pattern = rf'(?:var\s+{var}\s*=|window\.{var}\s*=)'
        if not re.search(pattern, js_content):
            warnings.append(f"构建验证: 关键全局变量 '{var}' 未定义")

    # 7. 全局变量名冲突检测（跨文件同名 var 定义）
    var_definitions = {}  # var_name -> [file_path, ...]
    for section_match in re.finditer(r'// === (.+?) ===', js_content):
        file_path = section_match.group(1)
        # 找到这个 section 中的所有顶层 var 定义
        section_start = section_match.end()
        next_section = re.search(r'\n// === ', js_content[section_start:])
        section_end = section_start + next_section.start() if next_section else len(js_content)
        section = js_content[section_start:section_end]
        for var_match in re.finditer(r'(?:var|const|let)\s+(\w+)\s*=', section):
            var_name = var_match.group(1)
            if var_name.startswith('_') or var_name in ('i', 'j', 'k', 'e', 'err', 'm', 'fn', 'cb', 'el', 'key', 'val', 'idx', 'len', 'str', 'obj', 'arr', 'data', 'result', 'opts', 'args', 'cfg', 'ctx', 'req', 'res', 'url', 'msg', 'err', 'item', 'items', 'row', 'rows', 'col', 'tab', 'nav', 'btn', 'div', 'span', 'p', 'a', 'h'):
                continue  # 跳过常见局部变量
            if var_name not in var_definitions:
                var_definitions[var_name] = []
            var_definitions[var_name].append(file_path)
    conflicts = {name: files for name, files in var_definitions.items() if len(files) > 1}
    if conflicts:
        conflict_details = [f"{name}({', '.join(files)})" for name, files in conflicts.items()]
        warnings.append(f"构建验证: {len(conflicts)} 个全局变量名冲突: {'; '.join(conflict_details[:5])}")

    return warnings


def build_full_html():
    """Build a completely self-contained HTML page with all CSS and JS inlined."""
    frontend_dir = Path(__file__).resolve().parent / "frontend"
    logger.info(f"build_full_html: frontend_dir={frontend_dir}, exists={frontend_dir.exists()}")

    # Load ALL CSS files and inline them
    css_files = ["css/style.css", "css/dark-theme.css", "css/knowledge.css", "css/workspace.css"]
    all_css = ""
    for css_path in css_files:
        full_path = frontend_dir / css_path
        css_content = load_file(full_path)
        logger.info(f"  CSS {css_path}: {len(css_content)} bytes (exists={full_path.exists()})")
        if css_content:
            all_css += f"/* === {css_path} === */\n{css_content}\n\n"
    logger.info(f"Total CSS loaded: {len(all_css)} bytes")

    # === 自动扫描 JS 文件（零硬编码，新增文件自动纳入构建） ===
    # 加载顺序: core → constants → api → components → services → utils → pages → app
    # 每个目录内按文件名排序，确保确定性
    js_base = frontend_dir / "js"

    def _scan_dir(rel_dir, exclude=None):
        """扫描目录下所有 .js 文件，返回相对路径列表（按文件名排序）"""
        exclude = exclude or set()
        d = js_base / rel_dir
        if not d.exists():
            return []
        result = []
        for jsf in sorted(d.glob("*.js")):
            if jsf.name in exclude:
                continue
            result.append(f"js/{rel_dir}/{jsf.name}")
        return result

    # 1. Core 模块（按固定依赖顺序）
    core_order = ["Logger.js", "Store.js", "Bus.js", "ErrorHandler.js",
                  "HermesClient.js", "APIClient.js", "constants.js", "Router.js", "init.js"]
    core_js = [f"js/core/{f}" for f in core_order]
    # core 目录下可能还有其他文件，也一并加入
    for extra in _scan_dir("core", exclude=set(core_order)):
        if extra not in core_js:
            core_js.append(extra)

    # 2. Constants（AppConfig, AppColors 等）
    core_js.extend(_scan_dir("constants"))

    # 3. API 层
    core_js.append("js/api.js")

    # 4. Components（index.js 必须最后加载）
    comp_all = _scan_dir("components")
    comp_index = [f for f in comp_all if f.endswith("/index.js")]
    comp_rest = [f for f in comp_all if not f.endswith("/index.js")]
    core_js.extend(comp_rest + comp_index)

    # 5. Services
    core_js.extend(_scan_dir("services"))

    # 6. Utilities
    core_js.extend(_scan_dir("utils"))
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

    # 7. Workspace 模块（iOS 桌面风格工作台）
    #    目录结构: frontend/js/workspace/{core,components,widgets,pages}/
    #    加载顺序: core → components → widgets → pages（确保依赖关系正确）
    workspace_dir = frontend_dir / "js" / "workspace"
    workspace_files = []
    if workspace_dir.exists():
        for sub_dir in ["core", "components", "widgets", "pages"]:
            sub_path = workspace_dir / sub_dir
            if sub_path.exists():
                if sub_dir == "widgets":
                    # widgets 子目录按类型排序加载
                    for type_dir in sorted(sub_path.iterdir()):
                        if type_dir.is_dir():
                            for jsf in sorted(type_dir.glob("*.js")):
                                workspace_files.append(f"js/workspace/{sub_dir}/{type_dir.name}/{jsf.name}")
                else:
                    for item in sorted(sub_path.iterdir()):
                        if item.is_file() and item.suffix == '.js':
                            workspace_files.append(f"js/workspace/{sub_dir}/{item.name}")
                        elif item.is_dir():
                            for jsf in sorted(item.glob("*.js")):
                                workspace_files.append(f"js/workspace/{sub_dir}/{item.name}/{jsf.name}")
        logger.info(f"Auto-discovered {len(workspace_files)} workspace files")
    else:
        logger.warning(f"Workspace directory not found: {workspace_dir}")

    js_files = core_js + workspace_files + page_files + app_js

    logger.info(f"Auto-discovered {len(page_files)} page files: {[f.split('/')[-1] for f in page_files]}")

    # Get changelog data for frontend injection
    _changelog_json = _get_changelog_json()
    logger.info(f"Changelog data: {len(_changelog_json)} bytes")

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

        def _resolve_import_path(rel_path):
            """Resolve relative import path against file_dir"""
            resolved = os.path.normpath(file_dir + '/' + rel_path)
            return resolved

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
            #    import X from '../Y.js' → remove
            if stripped.startswith("import ") and " from " in stripped and stripped.endswith(";"):
                continue

            # 4. import { A, B } from './C.js' → remove (same reason)
            #    import { A, B } from '../C.js' → remove
            if stripped.startswith("import {") and " from " in stripped and stripped.endswith(";"):
                continue

            # 5. (await) import('./X.js').default → window.__m['dir/X.js']
            #     (await) import('../X.js').default → window.__m['resolved/X.js']
            line = re.sub(
                r"\(?\s*await\s+import\(['\"](\.\.?\/[^'\"]+)['\"]\)\s*\)?\s*\.default",
                lambda m: "window.__m['" + _resolve_import_path(m.group(1)) + "']",
                line
            )
            # Also handle: var X = (await import('./X.js')).default;
            line = re.sub(
                r"await\s+import\(['\"](\.\.?\/[^'\"]+)['\"]\)\)\.default",
                lambda m: "window.__m['" + _resolve_import_path(m.group(1)) + "']",
                line
            )
            # Handle: import('./X.js').then(m => m.default.render(...))
            line = re.sub(
                r"import\(['\"](\.\.?\/[^'\"]+)['\"]\)\.then\(m\s*=>\s*m\.default\.(\w+)\(([^)]*)\)\)",
                lambda m: "(function(){ var _m = window.__m && window.__m['" + _resolve_import_path(m.group(1)) + "']; if(_m && _m.default) _m.default." + m.group(2) + "(" + m.group(3) + "); })()",
                line
            )

            # 6. (await) import('./X.js') → window.__m['dir/X.js']
            line = re.sub(
                r"\(?\s*await\s+import\(['\"](\.\.?\/[^'\"]+)['\"]\)\s*\)?",
                lambda m: "window.__m['" + _resolve_import_path(m.group(1)) + "']",
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

    # 注入构建版本信息
    build_commit = _get_build_version()
    build_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    version_inject = (
        f"window.__BUILD_VERSION__ = '{build_commit}';\n"
        f"window.__BUILD_TIME__ = '{build_time_str}';\n"
        f"window.__CHANGELOG_DATA__ = {_changelog_json};\n"
    )
    all_js = version_inject + all_js

    index_html = load_file(frontend_dir / "index.html")
    logger.info(f"index.html: {len(index_html)} bytes")

    # Replace CSS link with inline style (all CSS files combined)
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="[^"]*\.css"[^>]*>', '', index_html)
    html = html.replace('</head>', f'<style>\n{all_css}\n</style>\n</head>')

    # Remove all <script src=...> tags (with optional attributes like defer, type, etc.)
    html = re.sub(r'<script\s+[^>]*src="[^"]*"[^>]*></script>', '', html)

    # Insert all JS inline before </body>
    html = html.replace('</body>', f'<script>\n{all_js}\n</script>\n</body>')

    # 构建验证
    build_warnings = _validate_build(html)
    if build_warnings:
        for w in build_warnings:
            logger.warning(w)
    else:
        logger.info("构建验证通过，无警告")

    return html


logger.info("Initializing Hermes Agent MCP Space...")

import gradio as gr
from gradio.routes import App

# Build the full HTML FIRST (with fallback to original index.html on error)
_build_error = None
try:
    full_html = build_full_html()
    logger.info(f"Frontend HTML built ({len(full_html)} bytes)")
    # 构建成功，保存缓存
    _save_build_cache(full_html)
except Exception as e:
    _build_error = f"{type(e).__name__}: {e}"
    logger.error(f"build_full_html failed: {_build_error}")
    import traceback
    traceback.print_exc()

    # 尝试从缓存恢复
    cached_html = _load_build_cache()
    if cached_html:
        full_html = cached_html
        logger.info(f"从构建缓存恢复成功 ({len(full_html)} bytes)")
    else:
        # 最终回退到原始 index.html
        frontend_dir = Path(__file__).resolve().parent / "frontend"
        full_html = load_file(frontend_dir / "index.html")
        logger.warning(f"缓存不可用，使用原始 index.html ({len(full_html)} bytes) 作为最终回退")

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
            screenshot, persistence, version, ops, frontend_errors,
            rules, knowledge_items, experiences, memories as memories_router_mod, reviews,
            search as search_router
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
        app.include_router(rules.router)
        app.include_router(knowledge_items.router)
        app.include_router(experiences.router)
        app.include_router(memories_router_mod.router)
        app.include_router(reviews.router)
        app.include_router(search_router.router)
        app.include_router(screenshot.router)
        app.include_router(persistence.router)
        app.include_router(version.router)
        app.include_router(ops.router)
        app.include_router(frontend_errors.router)
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

    # Initialize knowledge database (create tables if not exist)
    try:
        from backend.db import get_knowledge_db, init_knowledge_db
        _db_conn = get_knowledge_db()
        init_knowledge_db(_db_conn)
        logger.info("Knowledge database initialized (tables created/verified)")
    except Exception as e:
        logger.warning(f"Failed to initialize knowledge database: {e}")

    # Initialize review scheduler (bridge policy -> cron)
    try:
        from backend.services.review_scheduler import review_scheduler
        review_scheduler.init()
        logger.info("Review scheduler initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize review scheduler: {e}")

    # Register evolution cron jobs
    try:
        from backend.services.cron_service import cron_service
        import json

        evolution_jobs = [
            {
                "name": "auto_chain",
                "schedule": "*/30 * * * *",
                "command": "curl -s -X POST http://localhost:7860/api/knowledge/auto-chain",
            },
            {
                "name": "knowledge_extract",
                "schedule": "0 * * * *",
                "command": "curl -s -X POST http://localhost:7860/api/knowledge/auto-extract",
            },
            {
                "name": "daily_evolution",
                "schedule": "0 3 * * *",
                "command": "curl -s -X POST http://localhost:7860/api/evolution/daily",
            },
            {
                "name": "full_learning",
                "schedule": "0 2 * * *",
                "command": "curl -s -X POST http://localhost:7860/api/knowledge/auto-learn",
            },
            {
                "name": "refresh_mcp",
                "schedule": "*/10 * * * *",
                "command": "curl -s -X POST http://localhost:7860/api/mcp/refresh",
            },
            {
                "name": "trash_cleanup",
                "schedule": "0 4 * * 0",
                "command": "curl -s -X POST http://localhost:7860/api/trash/auto-cleanup",
            },
            {
                "name": "compat_sync",
                "schedule": "0 4 * * *",
                "command": "curl -s -X POST http://localhost:7860/api/compat/auto-sync",
            },
            {
                "name": "weekly_skill_eval",
                "schedule": "0 5 * * 0",
                "command": "curl -s -X POST http://localhost:7860/api/skills/auto-eval-optimize",
            },
        ]

        existing_jobs = {j.get("name") for j in cron_service.list_cron_jobs()}
        for job_def in evolution_jobs:
            if job_def["name"] not in existing_jobs:
                cron_service.create_cron_job({**job_def, "enabled": True})
                logger.info(f"Created cron job: {job_def['name']} ({job_def['schedule']})")

        logger.info(f"Evolution cron jobs registered ({len(evolution_jobs)} total)")
    except Exception as e:
        logger.warning(f"Failed to register evolution cron jobs: {e}")

    # Auto-install recommended plugins on startup
    try:
        from backend.services.plugin_service import PluginService
        plugin_svc = PluginService()
        plugin_index_path = Path(get_hermes_home()) / "data" / "plugin_index.json"
        if plugin_index_path.exists():
            import json
            with open(plugin_index_path) as f:
                index = json.load(f)
            for plugin in index.get("plugins", []):
                if plugin.get("auto_install") and not plugin_svc.is_installed(plugin["name"]):
                    plugin_svc.install_plugin(plugin["name"])
                    logger.info(f"Auto-installed plugin: {plugin['name']}")
    except Exception as e:
        logger.warning(f"Plugin auto-install failed: {e}")

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

    # Add ErrorTrackerMiddleware（在 CORS 之后、其他中间件之前）
    try:
        from backend.middleware.error_tracker import ErrorTrackerMiddleware
        app.add_middleware(ErrorTrackerMiddleware)
        logger.info("Error tracker middleware added")
    except Exception as e:
        logger.warning(f"Failed to add error tracker middleware: {e}")

    # ── Self-evolution: Data integrity check ──
    try:
        from backend.services.data_integrity import data_integrity_checker
        report = data_integrity_checker.run_full_check(auto_fix=True)
        summary = report.get("summary", {})
        logger.info(f"Data integrity: {summary.get('status')} ({summary.get('total_checks')} checks, {summary.get('total_errors')} issues)")
    except Exception as e:
        logger.warning(f"Data integrity check failed: {e}")

    # ── Self-evolution: Session lifecycle cleanup ──
    try:
        from backend.services.session_lifecycle import session_lifecycle
        session_lifecycle.start_cleanup_thread()
        logger.info("Session lifecycle cleanup thread started")
    except Exception as e:
        logger.warning(f"Failed to start session lifecycle: {e}")

    # ── Self-evolution: EventBus handlers ──
    try:
        from backend.events.handlers import register_event_handlers
        handler_count = register_event_handlers()
        logger.info(f"EventBus handlers registered: {handler_count}")
    except Exception as e:
        logger.warning(f"Failed to register event handlers: {e}")

    # ── Self-evolution: Agent API router ──
    try:
        from backend.routers.agents_api import router as agents_api_router
        app.include_router(agents_api_router)
        logger.info("Agent API router mounted")
    except Exception as e:
        logger.warning(f"Failed to mount agent API router: {e}")

    # ── Ops Protocol: 启动运维上报客户端 ──
    try:
        from ops_agent import OpsClient
        ops_client = OpsClient(
            server="https://arwei944-ops-center.hf.space",
            project_id="hermes-mcp-space",
            project_name="Hermes Agent MCP Space",
            project_url="https://arwei944-hermes-mcp-space.hf.space",
            project_type="hf_docker",
            version=APP_VERSION,
            environment="production",
            heartbeat_interval=120,
        )
        ops_client.add_business_collector(lambda: {
            "mcp_tools_count": len(TOOL_DEFINITIONS) if 'TOOL_DEFINITIONS' in dir() else 0,
        })
        ops_client.start()
        try:
            import importlib.metadata as _im
            deps = []
            for pkg in ["gradio", "fastapi", "uvicorn", "httpx", "pydantic"]:
                try:
                    deps.append({"name": pkg, "version": _im.version(pkg)})
                except Exception:
                    pass
        except Exception:
            deps = []
        ops_client.snapshot(
            config={"port": 7860, "log_level": LOG_LEVEL, "ssr_mode": False},
            dependencies=deps,
            endpoints=[
                {"path": "/api/meta", "method": "GET", "description": "版本和元数据"},
                {"path": "/api/mcp/tools", "method": "GET", "description": "MCP工具列表"},
                {"path": "/api/chat", "method": "POST", "description": "聊天接口"},
            ],
            features=["mcp_server", "web_search", "knowledge_base", "agent_management", "session_management"],
            metadata={"build_time": BUILD_TIME, "app_version": APP_VERSION},
        )
        ops_client.emit_event("deploy", level="info", message=f"Hermes v{APP_VERSION} started", data={"version": APP_VERSION})
        logger.info("Ops Protocol client started")
    except Exception as e:
        logger.warning(f"Ops Protocol init failed: {e}")

    return app

App.create_app = staticmethod(_patched_create_app)

# Create Gradio Blocks (HF Spaces SDK needs the `demo` variable)
with gr.Blocks(title="Hermes Agent MCP Space") as demo:
    gr.HTML("<!-- Hermes Agent MCP Space -->")

logger.info(f"Hermes Agent MCP Space v{APP_VERSION} initialized")

# HF Spaces Gradio SDK will call demo.launch() for us
if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True, ssr_mode=False)
