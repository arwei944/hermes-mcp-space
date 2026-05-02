# -*- coding: utf-8 -*-
"""获取规则详情"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="rule_get",
        description="获取规则详情",
        schema={
            "type": "object",
            "properties": {
                "rule_id": {"type": "string", "description": "规则 ID"},
            },
            "required": ["rule_id"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    from backend.services.knowledge_service import KnowledgeService

    try:
        svc = KnowledgeService()
        rule = svc.get_rule(args["rule_id"])
        if not rule:
            return error_response(f"规则 {args['rule_id']} 不存在")
        return success_response(data=rule)
    except Exception as e:
        return error_response(str(e))
