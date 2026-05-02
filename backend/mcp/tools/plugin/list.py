# -*- coding: utf-8 -*-
"""列出所有已安装的插件"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_plugins",
        description="列出所有已安装的插件",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["plugin"],
    )


def handle(args: dict) -> dict:
    """列出所有已安装的插件"""
    try:
        from backend.services.plugin_service import plugin_service

        plugins = plugin_service.list_plugins()
        if not plugins:
            return success_response(message="暂无已安装插件")
        lines = [
            f"{p['name']} v{p.get('version', '?')} - {p.get('description', '无描述')} (by {p.get('author', '未知')})"
            for p in plugins
        ]
        return success_response(
            data={"plugins": plugins},
            message="\n".join(lines),
        )
    except Exception as e:
        return error_response(str(e))
