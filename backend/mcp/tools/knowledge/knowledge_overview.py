# -*- coding: utf-8 -*-
"""获取知识库概览统计"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="knowledge_overview",
        description="获取知识库概览统计",
        schema={
            "type": "object",
            "properties": {},
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService

    try:
        svc = KnowledgeService()
        stats = svc.get_overview_stats()
        return success_response(data=stats)
    except Exception as e:
        return error_response(str(e))
