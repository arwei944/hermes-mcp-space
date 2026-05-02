# -*- coding: utf-8 -*-
"""删除指定的定时任务"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="delete_cron_job",
        description="删除指定的定时任务",
        schema={
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "定时任务 ID"}
            },
            "required": ["job_id"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """delete_cron_job handler"""
    try:
        from backend.services.hermes_service import hermes_service

        result = hermes_service.delete_cron_job(args["job_id"])
        return success_response(result.get("message", "操作完成"))
    except Exception as e:
        return error_response(f"删除定时任务失败: {e}")
