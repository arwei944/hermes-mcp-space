# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - FastAPI 主入口

创建 FastAPI 应用，挂载所有路由和静态文件。
"""

from backend.version import __version__

from pathlib import Path
from typing import Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import get_config

# ==================== 创建 FastAPI 应用 ====================

app = FastAPI(
    title="Hermes Agent 管理面板",
    description="Hermes Agent 的 Web 管理面板后端 API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ==================== CORS 中间件（开发用，允许所有来源） ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 可选中间件（默认关闭，通过环境变量控制） ====================

from backend.middleware.auth import AuthMiddleware  # noqa: E402
from backend.middleware.rate_limit import RateLimitMiddleware  # noqa: E402
from backend.middleware.cache import CacheMiddleware  # noqa: E402

app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(CacheMiddleware)

# ==================== 注册路由 ====================

from backend.routers import (  # noqa: E402
    sessions,
    tools,
    skills,
    memory,
    cron,
    agents,
    config_api,
    mcp,
    plugins,
    persistence,
    knowledge,
    trash,
    ops,
)

# 知识库增强模块路由
from backend.routers import (  # noqa: E402
    rules,
    knowledge_items,
    experiences,
    memories as memories_router,
    reviews,
    search,
    context_budget,
    compat,
    dashboard,
    events,
    evals,
    stats,
    frontend_errors,
    screenshot,
    version,
    logs,
)

app.include_router(sessions.router)
app.include_router(tools.router)
app.include_router(skills.router)
app.include_router(memory.router)
app.include_router(cron.router)
app.include_router(agents.router)
app.include_router(config_api.router)
app.include_router(mcp.router)
app.include_router(plugins.router)
app.include_router(persistence.router)
app.include_router(knowledge.router)
app.include_router(trash.router)
app.include_router(ops.router)

# 知识库增强路由
app.include_router(rules.router)
app.include_router(knowledge_items.router)
app.include_router(experiences.router)
app.include_router(memories_router.router)
app.include_router(reviews.router)
app.include_router(search.router)
app.include_router(context_budget.router)
app.include_router(compat.router)

# Missing routers (synced from app.py)
app.include_router(dashboard.router)
app.include_router(events.router)
app.include_router(evals.router, prefix="/api", tags=["evals"])
app.include_router(stats.router, prefix="/api", tags=["stats"])
app.include_router(frontend_errors.router)
app.include_router(screenshot.router)
app.include_router(version.router)
app.include_router(logs.router)

# ==================== v1 API 版本化路由（与原路由共享实例，向后兼容） ====================

for _v1_prefix, _v1_router in [
    ("/api/v1/sessions", sessions.router),
    ("/api/v1/tools", tools.router),
    ("/api/v1/skills", skills.router),
    ("/api/v1/memory", memory.router),
    ("/api/v1/cron", cron.router),
    ("/api/v1/agents", agents.router),
    ("/api/v1/config", config_api.router),
    ("/api/v1/mcp", mcp.router),
    ("/api/v1/plugins", plugins.router),
    ("/api/v1/persistence", persistence.router),
    ("/api/v1/knowledge", knowledge.router),
    ("/api/v1/trash", trash.router),
]:
    app.include_router(_v1_router, prefix=_v1_prefix, tags=[f"v1-{_v1_prefix.split('/')[-1]}"])


# ==================== 静态文件和前端 ====================

# 获取前端目录路径（backend 的上级目录下的 frontend/）
BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"


def _mount_frontend():
    """挂载前端静态文件目录"""
    if FRONTEND_DIR.exists():
        # 挂载静态资源目录
        static_dir = FRONTEND_DIR / "static"
        if static_dir.exists():
            app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        # 挂载 assets 目录（Vite 构建产物）
        assets_dir = FRONTEND_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


_mount_frontend()


# ==================== 根路径 - 返回 index.html ====================

@app.get("/", include_in_schema=False)
async def serve_index():
    """根路径返回前端的 index.html"""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    # 如果前端未构建，返回简单的欢迎页面
    return {
        "name": "Hermes Agent 管理面板 API",
        "version": "2.0.0",
        "docs": "/docs",
        "message": "前端未构建，请先运行 npm run build 构建 frontend 目录",
    }


# ==================== 健康检查 ====================

@app.get("/api/health", tags=["system"])
async def health_check() -> Dict[str, str]:
    """健康检查接口"""
    return {"status": "healthy", "service": "hermes-mcp-space", "version": __version__}


# ==================== 启动和关闭事件 ====================

@app.on_event("startup")
async def on_startup():
    """应用启动时的初始化操作"""
    config = get_config()
    print(f"[Hermes Panel] 启动中...")
    print(f"[Hermes Panel] Hermes 主目录: {config['hermes_home']}")
    print(f"[Hermes Panel] 前端目录: {FRONTEND_DIR} (存在: {FRONTEND_DIR.exists()})")
    print(f"[Hermes Panel] API 文档: http://localhost:{config['port']}/docs")

    # 初始化知识库数据库
    try:
        from backend.db import get_knowledge_db, init_knowledge_db
        conn = get_knowledge_db()
        init_knowledge_db(conn)
        print(f"[Hermes Panel] 知识库数据库已初始化")
    except Exception as e:
        print(f"[Hermes Panel] ⚠️ 知识库数据库初始化失败: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    """应用关闭时的清理操作"""
    print("[Hermes Panel] 正在关闭...")


# ==================== 命令行启动入口 ====================

def main():
    """命令行启动入口"""
    import uvicorn
    config = get_config()
    uvicorn.run(
        "backend.main:app",
        host=config["host"],
        port=config["port"],
        reload=config["debug"],
    )


if __name__ == "__main__":
    main()
