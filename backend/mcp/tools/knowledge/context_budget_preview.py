# -*- coding: utf-8 -*-
"""预览当前上下文预算分配"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="context_budget_preview",
        description="预览当前上下文预算分配",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "会话 ID"},
                "query": {"type": "string", "description": "查询文本"},
            },
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.context_budget_service import ContextBudgetService

    try:
        budget_svc = ContextBudgetService()
        context = budget_svc.build_context(
            session_id=args.get("session_id", ""),
            query=args.get("query", ""),
        )
        return success_response(
            data={"content": context, "char_count": len(context)},
            message=f"上下文预算预览，共 {len(context)} 字符",
        )
    except Exception as e:
        return error_response(str(e))
