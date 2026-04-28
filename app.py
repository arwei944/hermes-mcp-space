# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Space - 部署入口
Gradio 托管 Mac 极简风格前端管理面板
支持版本管理和热更新
"""

import logging
import os
from pathlib import Path

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

# ==================== 创建 Gradio 应用 ====================

logger.info("正在初始化 Hermes Agent MCP Space...")

import gradio as gr
from starlette.staticfiles import StaticFiles

# 获取前端目录
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"

# 读取 index.html
index_path = FRONTEND_DIR / "index.html"
try:
    with open(index_path, "r", encoding="utf-8") as f:
        index_html = f.read()
    logger.info(f"前端 HTML 加载成功 ({len(index_html)} bytes)")
except Exception as e:
    logger.error(f"前端 HTML 加载失败: {e}")
    index_html = "<p>前端加载失败</p>"

with gr.Blocks(
    title="Hermes Agent MCP Space",
    css=".gradio-container{max-width:100%!important;padding:0!important;}",
) as demo:
    gr.HTML(index_html)

# 挂载前端静态文件目录（使用 starlette StaticFiles）
css_dir = str(FRONTEND_DIR / "css")
js_dir = str(FRONTEND_DIR / "js")
frontend_dir = str(FRONTEND_DIR)

if os.path.isdir(css_dir):
    demo.app.mount("/css", StaticFiles(directory=css_dir), name="css")
    logger.info("CSS 静态文件挂载成功: /css/")
if os.path.isdir(js_dir):
    demo.app.mount("/js", StaticFiles(directory=js_dir), name="js")
    logger.info("JS 静态文件挂载成功: /js/")
if os.path.isdir(frontend_dir):
    demo.app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")
    logger.info("前端静态文件挂载成功: /frontend/")

# 版本管理端点
@demo.app.get("/api/version")
async def get_version():
    return {"version": APP_VERSION, "build_time": BUILD_TIME}

@demo.app.get("/api/health")
async def health():
    return {"status": "ok", "service": "hermes-mcp-space", "version": APP_VERSION}

logger.info(f"Hermes Agent MCP Space v{APP_VERSION} 初始化完成")

# HF Spaces Gradio SDK 需要显式启动
demo.launch(server_name="0.0.0.0", server_port=7860, show_error=True)
