# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Space - ModelScope 部署入口
同时启动：FastAPI 管理面板 + MCP SSE 服务

部署到魔搭社区（ModelScope）时，Gradio SDK 会自动：
1. 安装 requirements.txt 中的依赖
2. 运行此文件作为入口
3. 将 Gradio 界面暴露为 Web 服务
"""

import atexit
import logging
import os
import signal
import sys
import threading
import time
from typing import Optional

# ==================== 日志配置 ====================

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("hermes-space")

# ==================== 全局配置 ====================

# 管理面板端口（FastAPI 内部服务）
PANEL_PORT = int(os.environ.get("PANEL_PORT", "7860"))
# MCP SSE 端口
MCP_SSE_PORT = int(os.environ.get("MCP_SSE_PORT", "8765"))
# 是否启用 MCP SSE 服务
ENABLE_MCP_SSE = os.environ.get("ENABLE_MCP_SSE", "true").lower() in ("true", "1", "yes")
# Hermes 主目录
HERMES_HOME = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))

# 后台线程引用（用于优雅关闭）
_panel_server: Optional[object] = None
_mcp_server: Optional[object] = None


# ==================== 后台服务启动 ====================

def start_panel_server() -> Optional[threading.Thread]:
    """在后台线程启动 FastAPI 管理面板"""
    import uvicorn
    from backend.main import app as panel_app

    def run():
        logger.info(f"启动管理面板: http://0.0.0.0:{PANEL_PORT}")
        uvicorn.run(
            panel_app,
            host="0.0.0.0",
            port=PANEL_PORT,
            log_level="warning",
        )

    thread = threading.Thread(target=run, daemon=True, name="panel-server")
    thread.start()

    # 等待管理面板启动
    for _ in range(30):
        time.sleep(0.5)
        try:
            import httpx
            resp = httpx.get(f"http://127.0.0.1:{PANEL_PORT}/api/health", timeout=2)
            if resp.status_code == 200:
                logger.info("管理面板启动成功")
                return thread
        except Exception:
            continue

    logger.warning("管理面板启动超时，但仍在后台运行")
    return thread


def start_mcp_sse_server() -> Optional[threading.Thread]:
    """在后台线程启动 MCP SSE 服务"""
    if not ENABLE_MCP_SSE:
        logger.info("MCP SSE 服务已禁用 (ENABLE_MCP_SSE != true)")
        return None

    def run():
        logger.info(f"启动 MCP SSE 服务: http://0.0.0.0:{MCP_SSE_PORT}/sse")
        from mcp_server import create_mcp_server
        mcp = create_mcp_server()
        mcp.run(transport="sse", host="0.0.0.0", port=MCP_SSE_PORT)

    thread = threading.Thread(target=run, daemon=True, name="mcp-sse-server")
    thread.start()

    # 等待 MCP SSE 服务启动
    for _ in range(30):
        time.sleep(0.5)
        try:
            import httpx
            resp = httpx.get(f"http://127.0.0.1:{MCP_SSE_PORT}/sse", timeout=2)
            # SSE 端点即使正常也可能返回非 200，只要能连接即可
            logger.info("MCP SSE 服务启动成功")
            return thread
        except Exception:
            continue

    logger.warning("MCP SSE 服务启动超时，但仍在后台运行")
    return thread


# ==================== 优雅关闭 ====================

def cleanup():
    """清理所有后台服务"""
    logger.info("正在关闭所有后台服务...")
    # daemon 线程会随主进程退出自动终止
    logger.info("清理完成")


atexit.register(cleanup)


# ==================== Gradio 界面 ====================

def build_gradio_app() -> "gr.Blocks":
    """构建 Gradio 前端界面"""
    import gradio as gr

    # 状态信息
    panel_url = f"http://127.0.0.1:{PANEL_PORT}"
    mcp_sse_url = f"http://127.0.0.1:{MCP_SSE_PORT}/sse" if ENABLE_MCP_SSE else "未启用"

    with gr.Blocks(
        title="Hermes Agent MCP Space",
        theme=gr.themes.Soft(
            primary_hue="indigo",
            secondary_hue="slate",
        ),
        css="""
        .container {
            max-width: 960px;
            margin: 0 auto;
            padding: 2rem;
        }
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .header h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 0.5rem;
        }
        .header p {
            color: #64748b;
            font-size: 1.1rem;
        }
        .status-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        }
        .status-card h3 {
            color: #334155;
            margin-bottom: 0.75rem;
            font-size: 1.1rem;
        }
        .status-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #f1f5f9;
        }
        .status-item:last-child {
            border-bottom: none;
        }
        .status-label {
            color: #64748b;
            font-weight: 500;
        }
        .status-value {
            color: #1e293b;
            font-family: monospace;
        }
        .status-ok {
            color: #16a34a;
            font-weight: 600;
        }
        .status-warn {
            color: #d97706;
            font-weight: 600;
        }
        .iframe-container {
            width: 100%;
            height: 600px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 1rem;
        }
        .iframe-container iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        .tools-section {
            margin-top: 1.5rem;
        }
        .tools-section h3 {
            color: #334155;
            margin-bottom: 0.75rem;
        }
        .tool-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.5rem;
        }
        .tool-tag {
            background: #eef2ff;
            color: #4338ca;
            padding: 0.4rem 0.8rem;
            border-radius: 6px;
            font-size: 0.85rem;
            font-family: monospace;
        }
        """,
    ) as demo:

        gr.HTML("""
        <div class="container">
            <div class="header">
                <h1>Hermes Agent MCP Space</h1>
                <p>基于 ModelScope Gradio SDK 部署的 Hermes Agent MCP 服务</p>
            </div>
        </div>
        """)

        with gr.Row():
            with gr.Column(scale=1):
                gr.HTML(f"""
                <div class="status-card">
                    <h3>服务状态</h3>
                    <div class="status-item">
                        <span class="status-label">管理面板</span>
                        <span class="status-value status-ok" id="panel-status">运行中</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">面板地址</span>
                        <span class="status-value">{panel_url}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">MCP SSE</span>
                        <span class="status-value {'status-ok' if ENABLE_MCP_SSE else 'status-warn'}">
                            {'运行中' if ENABLE_MCP_SSE else '未启用'}
                        </span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">SSE 端点</span>
                        <span class="status-value">{mcp_sse_url}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Hermes 主目录</span>
                        <span class="status-value">{HERMES_HOME}</span>
                    </div>
                </div>
                """)

            with gr.Column(scale=1):
                gr.HTML("""
                <div class="status-card">
                    <h3>快速开始</h3>
                    <div style="color: #475569; line-height: 1.8;">
                        <p><strong>1. Trae / Cursor 连接 MCP:</strong></p>
                        <p style="font-family: monospace; background: #f1f5f9; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem;">
                            { "mcpServers": { "hermes": { "url": "SSE_URL" } } }
                        </p>
                        <p style="margin-top: 0.75rem;"><strong>2. 管理面板:</strong></p>
                        <p>点击下方「打开管理面板」按钮访问完整管理界面</p>
                        <p style="margin-top: 0.75rem;"><strong>3. API 文档:</strong></p>
                        <p>管理面板启动后访问 /docs 查看 Swagger API 文档</p>
                    </div>
                </div>
                """)

        # 管理面板 iframe 嵌入
        with gr.Accordion("管理面板", open=True):
            gr.HTML(f"""
            <div class="iframe-container">
                <iframe src="{panel_url}" allow="fullscreen"></iframe>
            </div>
            """)
            gr.Button("在新标签页打开管理面板", link=panel_url)

        # 工具列表展示
        with gr.Accordion("MCP 工具列表 (24 个)", open=False):
            tools_html = """
            <div class="tools-section">
                <div class="tool-grid">
            """
            tool_names = [
                "hermes_web_search", "hermes_web_extract", "hermes_terminal",
                "hermes_read_file", "hermes_write_file", "hermes_patch_file",
                "hermes_search_files", "hermes_execute_code", "hermes_vision_analyze",
                "hermes_image_generate", "hermes_memory_read", "hermes_memory_write",
                "hermes_skills_list", "hermes_skill_view", "hermes_session_search",
                "hermes_delegate_task", "hermes_todo", "hermes_cronjob_manage",
                "hermes_send_message", "hermes_browser_navigate", "hermes_browser_click",
                "hermes_browser_type", "hermes_browser_screenshot", "hermes_text_to_speech",
            ]
            for name in tool_names:
                tools_html += f'<span class="tool-tag">{name}</span>\n'
            tools_html += "</div></div>"
            gr.HTML(tools_html)

        # 连接配置说明
        with gr.Accordion("MCP 客户端配置说明", open=False):
            gr.HTML("""
            <div style="color: #475569; line-height: 1.8;">
                <h4 style="color: #334155;">Trae IDE 配置</h4>
                <p>在 Trae 的 MCP 设置中添加：</p>
                <pre style="background: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto;">
{
  "mcpServers": {
    "hermes": {
      "url": "http://YOUR_SPACE_URL/sse"
    }
  }
}</pre>

                <h4 style="color: #334155; margin-top: 1.5rem;">Cursor 配置</h4>
                <p>在 Cursor 的 MCP 设置中添加相同的配置。</p>

                <h4 style="color: #334155; margin-top: 1.5rem;">stdio 模式（本地开发）</h4>
                <pre style="background: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto;">
{
  "mcpServers": {
    "hermes": {
      "command": "python",
      "args": ["/path/to/mcp_server.py"]
    }
  }
}</pre>
            </div>
            """)

    return demo


# ==================== 主入口 ====================

def main():
    """主入口函数"""
    logger.info("=" * 60)
    logger.info("  Hermes Agent MCP Space 启动中...")
    logger.info(f"  管理面板端口: {PANEL_PORT}")
    logger.info(f"  MCP SSE 端口: {MCP_SSE_PORT}")
    logger.info(f"  MCP SSE 启用: {ENABLE_MCP_SSE}")
    logger.info(f"  Hermes 主目录: {HERMES_HOME}")
    logger.info("=" * 60)

    # 1. 启动 FastAPI 管理面板（后台线程）
    panel_thread = start_panel_server()
    global _panel_server
    _panel_server = panel_thread

    # 2. 启动 MCP SSE 服务（后台线程，可选）
    if ENABLE_MCP_SSE:
        mcp_thread = start_mcp_sse_server()
        global _mcp_server
        _mcp_server = mcp_thread

    # 3. 构建并启动 Gradio 界面（阻塞主线程）
    logger.info("启动 Gradio 界面...")
    demo = build_gradio_app()
    demo.launch(
        server_name="0.0.0.0",
        server_port=PANEL_PORT,
        share=False,
        show_error=True,
        quiet=False,
    )


if __name__ == "__main__":
    main()
