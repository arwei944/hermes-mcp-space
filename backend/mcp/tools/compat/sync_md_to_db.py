# -*- coding: utf-8 -*-
"""从 MD 文件导入到知识库（MEMORY.md + USER.md + learnings.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="compat_sync_md_to_db",
        description="从 MD 文件导入到知识库（MEMORY.md + USER.md + learnings.md）",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["compat"],
    )


def handle(args: dict) -> dict:
    """从 MD 文件导入到知识库"""
    try:
        from backend.services.compat_service import CompatService

        svc = CompatService()
        results = {
            "memory_imported": svc.import_memory_md(),
            "user_imported": svc.import_user_md(),
            "learnings_imported": svc.import_learnings_md(),
        }
        svc.save_memory_md()
        svc.save_user_md()
        svc.save_learnings_md()
        total = sum(results.values())
        return success_response(
            data=results,
            message=f"导入 {total} 条记录",
        )
    except Exception as e:
        return error_response(f"知识库工具 'compat_sync_md_to_db' 执行失败: {e}")
