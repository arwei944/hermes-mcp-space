# -*- coding: utf-8 -*-
"""创建一个定时任务"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="create_cron_job",
        description="创建一个定时任务",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "任务名称"},
                "schedule": {"type": "string", "description": "Cron 表达式，如 '0 9 * * *'"},
                "command": {"type": "string", "description": "要执行的命令或任务描述"}
            },
            "required": ["name", "schedule", "command"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """create_cron_job handler"""
    try:
        from backend.services.hermes_service import hermes_service

        result = hermes_service.create_cron_job({
            "name": args["name"],
            "schedule": args["schedule"],
            "command": args["command"],
        })
        return success_response(result.get("message", "操作完成"))
    except Exception as e:
        return error_response(f"创建定时任务失败: {e}")
