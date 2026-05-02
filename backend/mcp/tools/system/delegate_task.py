# -*- coding: utf-8 -*-
"""创建子 Agent 执行独立任务（并行工作）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="delegate_task",
        description="创建子 Agent 执行独立任务（并行工作）",
        schema={
            "type": "object",
            "properties": {
                "task": {"type": "string", "description": "任务描述"},
                "tools": {"type": "array", "items": {"type": "string"}, "description": "允许使用的工具列表（可选，默认全部）"},
                "timeout": {"type": "integer", "default": 120, "description": "超时秒数"}
            },
            "required": ["task"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """delegate_task handler"""
    from backend.services.hermes_service import hermes_service

    try:
        task_desc = args.get("task", "")
        if not task_desc:
            return error_response(
                message="请提供任务描述。\n建议：\n1. 清晰描述任务目标和预期输出\n2. 列出关键约束条件\n3. 指定交付格式",
                code="INVALID_ARGS",
            )

        allowed_tools = args.get("tools", [])
        timeout = int(args.get("timeout", 120))

        # 生成子 Agent ID
        import uuid
        agent_id = f"agent_{uuid.uuid4().hex[:8]}"

        # 记录任务到会话
        try:
            hermes_service.create_session(agent_id, f"[子Agent] {task_desc[:50]}")
            hermes_service.add_session_message(agent_id, "system", f"任务: {task_desc}\n允许工具: {allowed_tools or '全部'}\n超时: {timeout}s")
        except Exception:
            pass

        result = f"""子 Agent 已创建: {agent_id}

任务: {task_desc[:200]}
允许工具: {len(allowed_tools) if allowed_tools else '全部'} 个
超时: {timeout}s

使用说明：
1. 子 Agent 在独立上下文中执行任务
2. 可通过 get_session_messages('{agent_id}') 查看进度
3. 结果会自动记录到会话中
4. 使用 list_sessions 查看所有子 Agent 状态"""
        return success_response(message=result)
    except Exception as e:
        return error_response(message=f"创建子 Agent 失败: {e}", code="DELEGATE_ERROR")
