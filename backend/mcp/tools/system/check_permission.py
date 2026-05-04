# -*- coding: utf-8 -*-
"""查询 Agent 权限 — 查看当前角色的工具和数据访问权限"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="check_permission",
        description="查询 Agent 权限 — 查看当前角色的工具和数据访问权限",
        schema={
            "type": "object",
            "properties": {
                "tool_name": {
                    "type": "string",
                    "description": "要检查的工具名称（可选，不填则返回完整权限摘要）",
                },
                "agent_id": {
                    "type": "string",
                    "description": "Agent ID（可选，默认当前 Agent）",
                },
            },
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    from backend.services.permission_service import permission_service

    try:
        agent_id = args.get("agent_id", "")
        tool_name = args.get("tool_name", "")

        if tool_name:
            # 检查特定工具的权限
            allowed, reason = permission_service.check_tool_permission(
                tool_name, agent_id=agent_id
            )
            return success_response(
                data={
                    "tool": tool_name,
                    "allowed": allowed,
                    "reason": reason if not allowed else "权限允许",
                }
            )
        else:
            # 返回完整权限摘要
            role = "general"
            if agent_id:
                try:
                    from backend.services.agent_identity import agent_identity_manager
                    agent = agent_identity_manager.get_agent(agent_id)
                    if agent:
                        role = agent.get("role", "general")
                except Exception:
                    pass

            summary = permission_service.get_permission_summary(role)
            return success_response(data=summary)
    except Exception as e:
        return error_response(str(e))
