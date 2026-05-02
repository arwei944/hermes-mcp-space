# -*- coding: utf-8 -*-
"""从知识库导出到 MD 文件"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="compat_sync_db_to_md",
        description="从知识库导出到 MD 文件",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["compat"],
    )


def handle(args: dict) -> dict:
    """从知识库导出到 MD 文件"""
    try:
        from backend.services.compat_service import CompatService

        svc = CompatService()
        svc.save_memory_md()
        svc.save_user_md()
        svc.save_learnings_md()
        return success_response(message="已同步到 MD 文件")
    except Exception as e:
        return error_response(f"知识库工具 'compat_sync_db_to_md' 执行失败: {e}")
