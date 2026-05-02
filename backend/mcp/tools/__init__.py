# -*- coding: utf-8 -*-
"""工具模块自动发现 — 导入时自动加载所有工具"""

def _auto_discover():
    """延迟导入，避免循环依赖"""
    try:
        from backend.mcp.registry import registry
        registry.discover()
    except Exception as e:
        import logging
        logging.getLogger("hermes-mcp").warning(f"工具自动发现失败: {e}")

# 注意：不在此处自动调用，由 mcp_server.py 启动时显式调用
