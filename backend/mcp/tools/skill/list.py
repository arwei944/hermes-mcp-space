# -*- coding: utf-8 -*-
"""列出所有可用的技能"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_skills",
        description="列出所有可用的技能",
        schema={
            "type": "object",
            "properties": {}
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """列出所有可用的技能"""
    from backend.services.hermes_service import hermes_service

    try:
        # 传递当前可用工具列表用于条件激活
        try:
            from backend.mcp_server import _get_tools
            all_tools = _get_tools()
            available_tool_names = [t["name"] for t in all_tools]
            result = hermes_service.list_skills(available_tool_names)
        except Exception:
            result = hermes_service.list_skills()

        if not result:
            return success_response(
                data={"skills": [], "total": 0},
                message="当前没有可用技能。使用 create_skill 创建新技能。",
            )
        output = [f"可用技能 ({len(result)} 个)\n{'='*50}"]
        for s in result:
            desc = s.get("description", "无描述")
            tags = ", ".join(s.get("tags", []))
            line = f"  {s['name']}"
            if desc:
                line += f" - {desc[:60]}"
            if tags:
                line += f" [{tags}]"
            output.append(line)
        return success_response(
            data={"skills": result, "total": len(result)},
            message="\n".join(output),
        )
    except Exception as e:
        return error_response(str(e))
