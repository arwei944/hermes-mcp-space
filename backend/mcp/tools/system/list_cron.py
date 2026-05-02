# -*- coding: utf-8 -*-
"""列出所有定时任务"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_cron_jobs",
        description="列出所有定时任务",
        schema={"type": "object", "properties": {}},
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """list_cron_jobs handler"""
    try:
        from backend.services.hermes_service import hermes_service

        jobs = hermes_service.list_cron_jobs()
        if not jobs:
            return success_response("当前没有定时任务")
        lines = []
        for j in jobs:
            status = "✅" if j.get("status") == "active" else "⏸️"
            lines.append(
                f"{status} [{j.get('id', '?')}] {j.get('name', '?')} | "
                f"{j.get('schedule', '?')} | {j.get('command', '?')}"
            )
        result = f"共 {len(jobs)} 个定时任务:\n" + "\n".join(lines)
        return success_response(result)
    except Exception as e:
        return error_response(f"列出定时任务失败: {e}")
