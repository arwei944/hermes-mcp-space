# -*- coding: utf-8 -*-
"""安装插件（name=内置插件名 或 source=Git仓库URL）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="install_plugin",
        description="安装插件（name=内置插件名 或 source=Git仓库URL）",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "内置插件名称（如 code-analyzer）"},
                "source": {"type": "string", "description": "Git 仓库 URL"},
            },
        },
        handler=handle,
        tags=["plugin"],
    )


def handle(args: dict) -> dict:
    """安装插件"""
    try:
        from backend.services.plugin_service import plugin_service

        plugin_name = args.get("name", "")
        source = args.get("source", "")
        if plugin_name:
            result = plugin_service.install_builtin(plugin_name)
        elif source:
            result = plugin_service.install_plugin(source)
        else:
            return error_response("请提供 name（内置插件名）或 source（Git 仓库 URL）参数")
        return success_response(message=result.get("message", "安装完成"))
    except Exception as e:
        return error_response(str(e))
