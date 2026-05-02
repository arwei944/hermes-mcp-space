# -*- coding: utf-8 -*-
"""获取当前系统配置"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="get_config",
        description="获取当前系统配置",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """get_config handler"""
    try:
        import json
        from backend.config import get_config

        config = get_config()
        # 脱敏
        sensitive = {"api_key", "token", "password", "secret"}
        safe = {}
        for k, v in config.items():
            if any(s in k.lower() for s in sensitive):
                safe[k] = "****"
            else:
                safe[k] = v
        result = json.dumps(safe, ensure_ascii=False, indent=2)
        return success_response(result)
    except Exception as e:
        return error_response(f"获取配置失败: {e}")
