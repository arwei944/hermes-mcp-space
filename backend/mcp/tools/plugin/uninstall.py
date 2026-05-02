# -*- coding: utf-8 -*-
"""卸载插件"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="uninstall_plugin",
        description="卸载插件",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "插件名称"}
            },
            "required": ["name"],
        },
        handler=handle,
        tags=["plugin"],
    )


def handle(args: dict) -> dict:
    """卸载插件"""
    try:
        from backend.services.plugin_service import plugin_service

        plugin_name = args.get("name", "")
        if not plugin_name:
            return error_response("请提供 name 参数")
        result = plugin_service.uninstall_plugin(plugin_name)
        return success_response(message=result.get("message", "卸载完成"))
    except Exception as e:
        return error_response(str(e))
