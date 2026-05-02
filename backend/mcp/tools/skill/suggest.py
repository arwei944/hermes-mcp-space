# -*- coding: utf-8 -*-
"""分析会话中的工具调用模式，建议创建可复用技能"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="suggest_skill",
        description="分析会话中的工具调用模式，建议创建可复用技能",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "要分析的会话 ID（可选，默认最近会话）"},
                "min_calls": {"type": "integer", "default": 3, "description": "最少调用次数才触发建议"}
            },
            "required": []
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """suggest_skill handler"""
    from backend.services.hermes_service import hermes_service

    try:
        import re
        session_id = args.get("session_id", "")
        min_calls = int(args.get("min_calls", 3))

        # 获取会话列表
        sessions = hermes_service.list_sessions()
        if not sessions:
            return success_response(message="暂无会话数据，无法分析工具调用模式。")

        # 使用指定会话或最近会话
        target_id = session_id or sessions[0].get("id", "")
        messages = hermes_service.get_session_messages(target_id)
        if not messages:
            return success_response(message=f"会话 {target_id} 没有消息。")

        # 分析工具调用模式（从消息中提取 tool_call 模式）
        tool_pattern = {}
        for msg in messages:
            content = msg.get("content", "")
            # 简单匹配工具调用模式
            tool_calls = re.findall(r'(?:调用|使用|执行)\s*(\w+)', content)
            for t in tool_calls:
                tool_pattern[t] = tool_pattern.get(t, 0) + 1

        # 也从 eval_service 获取真实调用数据
        try:
            from backend.services.eval_service import eval_service
            tool_stats = eval_service.get_tool_stats()
            for stat in tool_stats:
                tool_name = stat.get("tool", "")
                count = stat.get("calls", 0)
                if count >= min_calls:
                    tool_pattern[tool_name] = max(tool_pattern.get(tool_name, 0), count)
        except Exception:
            pass

        if not tool_pattern:
            return success_response(
                message="未发现重复的工具调用模式。建议：\n1. 多使用工具后再次分析\n2. 降低 min_calls 阈值"
            )

        # 生成技能建议
        suggestions = []
        for tool, count in sorted(tool_pattern.items(), key=lambda x: -x[1]):
            if count >= min_calls:
                suggestions.append(f"  - {tool}: 调用 {count} 次")

        if not suggestions:
            current = "\n".join(f"  - {t}: {c} 次" for t, c in sorted(tool_pattern.items(), key=lambda x: -x[1])[:5])
            return success_response(message=f"未发现调用次数 >= {min_calls} 的工具模式。当前模式：\n{current}")

        # 生成技能草案
        skill_name = f"auto-{target_id[:8]}"
        nl = "\n"
        draft = f"""# 建议技能: {skill_name}

## 触发条件
以下工具被频繁调用：
{nl.join(suggestions)}

## 建议操作
1. 审查上述工具调用是否构成可复用工作流
2. 如果是，使用 create_skill 创建技能
3. 技能内容应包含：触发条件、执行步骤、预期输出

## 草案内容
```markdown
# {skill_name}
## 描述
自动生成的技能（基于会话 {target_id[:12]} 的工具调用模式）

## 触发条件
当需要频繁使用以下工具时激活：
{nl.join(suggestions)}

## 执行步骤
1. 按照工具调用顺序执行
2. 检查每步输出是否符合预期
3. 记录结果到学习记录
```

使用 create_skill 创建此技能，或调整内容后创建。"""

        return success_response(
            data={"skill_name": skill_name, "suggestions": suggestions, "tool_pattern": tool_pattern},
            message=draft,
        )
    except Exception as e:
        return error_response(message=f"技能建议分析失败: {e}", code="SUGGEST_ERROR")
