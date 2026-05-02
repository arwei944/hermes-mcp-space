# -*- coding: utf-8 -*-
"""更新系统配置"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="update_config",
        description="更新系统配置",
        schema={
            "type": "object",
            "properties": {
                "temperature": {"type": "number", "description": "模型温度（0-2）"},
                "log_level": {"type": "string", "description": "日志级别（DEBUG/INFO/WARNING/ERROR）"}
            }
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """update_config handler"""
    try:
        import yaml
        from backend.config import get_hermes_home, reload_config

        hermes_home = get_hermes_home()
        config_path = hermes_home / "config.yaml"
        existing = {}
        if config_path.exists():
            try:
                existing = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
            except Exception:
                pass
        existing.update(args)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(yaml.dump(existing, allow_unicode=True, default_flow_style=False), encoding="utf-8")
        reload_config()  # 清除缓存，使 get_config 读取最新配置
        result = f"配置已更新: {', '.join(args.keys())}"
        return success_response(result)
    except Exception as e:
        return error_response(f"更新配置失败: {e}")
