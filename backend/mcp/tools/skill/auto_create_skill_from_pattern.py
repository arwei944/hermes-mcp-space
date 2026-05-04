# -*- coding: utf-8 -*-
"""分析会话中的工具调用模式，自动从重复模式创建技能"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="auto_create_skill_from_pattern",
        description="分析会话中的工具调用模式，自动从重复模式创建技能",
        schema={
            "type": "object",
            "properties": {
                "min_occurrences": {
                    "type": "integer",
                    "default": 3,
                    "description": "模式最少出现次数才触发自动创建",
                },
                "lookback_sessions": {
                    "type": "integer",
                    "default": 20,
                    "description": "回溯分析的会话数量",
                },
                "auto_approve": {
                    "type": "boolean",
                    "default": False,
                    "description": "是否自动批准创建（不启用则仅报告建议）",
                },
            },
            "required": [],
        },
        handler=handle,
        tags=["skill"],
    )


def _extract_tool_calls_from_messages(messages: list) -> list:
    """从会话消息中提取工具调用序列"""
    import re
    import json

    tool_calls = []
    for msg in messages:
        content = msg.get("content", "")
        if not content:
            continue

        # 尝试解析 JSON 格式的工具调用
        # 模式1: {"name": "tool_name", "arguments": {...}}
        try:
            json_matches = re.findall(r'\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*\}', content)
            for tool_name in json_matches:
                tool_calls.append(tool_name)
        except Exception:
            pass

        # 模式2: 调用/使用/执行 tool_name
        text_matches = re.findall(r'(?:调用|使用|执行)\s*(\w+)', content)
        for tool_name in text_matches:
            tool_calls.append(tool_name)

        # 模式3: MCP 工具调用格式 - tool_name(args)
        mcp_matches = re.findall(r'(?:mcp_)?(\w+)\s*\(', content)
        for tool_name in mcp_matches:
            if tool_name not in ("if", "for", "while", "def", "class", "print", "len", "str", "int"):
                tool_calls.append(tool_name)

    return tool_calls


def _extract_sequences(tool_calls: list, min_len: int = 2, max_len: int = 4) -> dict:
    """从工具调用列表中提取连续序列模式"""
    from collections import Counter

    sequences = Counter()
    for length in range(min_len, max_len + 1):
        for i in range(len(tool_calls) - length + 1):
            seq = tuple(tool_calls[i:i + length])
            sequences[seq] += 1

    return sequences


def _generate_skill_name(sequence: tuple) -> str:
    """从工具序列生成技能名称"""
    parts = []
    for tool in sequence:
        # 简化工具名，去掉常见前缀
        clean = tool.replace("_", "-")
        if clean.startswith("mcp-"):
            clean = clean[4:]
        parts.append(clean)
    return "auto-" + "-then-".join(parts[:3])


def _generate_skill_content(sequence: tuple, count: int) -> str:
    """从工具序列生成技能内容"""
    nl = "\n"
    tools_str = " -> ".join(sequence)
    steps = nl.join([f"{i+1}. 调用 {tool}" for i, tool in enumerate(sequence)])

    content = f"""# 自动生成技能: {_generate_skill_name(sequence)}

## 描述
自动从会话模式中提炼的复合技能，检测到以下工具调用序列被频繁使用。

## 触发条件
当需要依次执行以下工具时激活此技能：
{tools_str}

## 执行步骤
{steps}

## 统计信息
- 模式出现次数: {count}
- 工具数量: {len(sequence)}
- 自动生成时间: 自动分析

## 注意事项
- 此技能由系统自动生成，建议人工审核后使用
- 可根据实际需求调整执行步骤和参数
"""
    return content


def handle(args: dict) -> dict:
    """分析会话模式并自动创建技能"""
    from backend.services.skill_service import SkillService
    from backend.services.session_service import SessionService

    try:
        import re
        from collections import Counter

        min_occurrences = int(args.get("min_occurrences", 3))
        lookback_sessions = int(args.get("lookback_sessions", 20))
        auto_approve = args.get("auto_approve", False)

        skill_svc = SkillService()
        session_svc = SessionService()

        # 获取会话列表
        sessions = session_svc.list_sessions()
        if not sessions:
            return success_response(message="暂无会话数据，无法分析工具调用模式。")

        # 取最近 N 个会话
        recent_sessions = sessions[:lookback_sessions]

        # 收集所有工具调用
        all_tool_calls = []
        sessions_analyzed = 0
        for session in recent_sessions:
            sid = session.get("id", "")
            if not sid:
                continue
            try:
                messages = session_svc.get_session_messages(sid)
                if messages:
                    tool_calls = _extract_tool_calls_from_messages(messages)
                    if tool_calls:
                        all_tool_calls.extend(tool_calls)
                        sessions_analyzed += 1
            except Exception:
                continue

        if not all_tool_calls:
            return success_response(
                message=f"分析了 {sessions_analyzed} 个会话，未发现工具调用记录。"
            )

        # 提取序列模式
        sequences = _extract_sequences(all_tool_calls)

        # 也尝试使用 AutoLearner 获取额外模式
        auto_learner_patterns = []
        try:
            from backend.services.auto_learner import analyze_patterns, suggest_skills
            patterns = analyze_patterns()
            suggestions = suggest_skills()
            auto_learner_patterns = patterns + suggestions
        except Exception:
            pass

        # 筛选达到阈值的模式
        qualified = []
        for seq, count in sequences.items():
            if count >= min_occurrences and len(seq) >= 2:
                qualified.append({
                    "sequence": seq,
                    "count": count,
                    "skill_name": _generate_skill_name(seq),
                })

        # 合并 AutoLearner 的建议
        for ap in auto_learner_patterns:
            ap_name = ap.get("name", "")
            ap_freq = ap.get("frequency", ap.get("total_calls", 0))
            ap_tools = ap.get("tools", [])
            if ap_freq >= min_occurrences and ap_tools:
                # 避免重复
                existing_names = {q["skill_name"] for q in qualified}
                if ap_name not in existing_names:
                    qualified.append({
                        "sequence": tuple(ap_tools),
                        "count": ap_freq,
                        "skill_name": ap_name,
                        "description": ap.get("description", ""),
                    })

        # 按出现次数排序
        qualified.sort(key=lambda x: x["count"], reverse=True)

        if not qualified:
            # 显示当前模式供参考
            top_patterns = sequences.most_common(5)
            pattern_lines = []
            for seq, count in top_patterns:
                pattern_lines.append(f"  {' -> '.join(seq)}: {count} 次")
            return success_response(
                message=(
                    f"分析了 {sessions_analyzed} 个会话，共 {len(all_tool_calls)} 次工具调用。\n"
                    f"未发现出现次数 >= {min_occurrences} 的重复模式。\n"
                    f"当前最常见模式：\n" + "\n".join(pattern_lines) + "\n\n"
                    f"建议：降低 min_occurrences 阈值后重试。"
                )
            )

        # 创建技能或仅报告
        skills_created = []
        skills_skipped = []
        nl = "\n"

        for item in qualified:
            seq = item["sequence"]
            skill_name = item["skill_name"]
            count = item["count"]

            # 检查技能是否已存在
            existing = skill_svc.get_skill(skill_name)
            if existing:
                skills_skipped.append({
                    "name": skill_name,
                    "reason": "技能已存在",
                    "occurrence_count": count,
                })
                continue

            if auto_approve:
                # 自动创建
                content = _generate_skill_content(seq, count)
                description = item.get("description", f"自动生成的复合技能: {' -> '.join(seq)}")
                result = skill_svc.create_skill(
                    name=skill_name,
                    content=content,
                    description=description,
                    tags=["auto-generated", "pattern"],
                )
                if result.get("success"):
                    skills_created.append({
                        "name": skill_name,
                        "pattern_description": f"{' -> '.join(seq)}",
                        "occurrence_count": count,
                        "status": "created",
                    })
                else:
                    skills_skipped.append({
                        "name": skill_name,
                        "reason": result.get("message", "创建失败"),
                        "occurrence_count": count,
                    })
            else:
                # 仅报告建议
                skills_created.append({
                    "name": skill_name,
                    "pattern_description": f"{' -> '.join(seq)}",
                    "occurrence_count": count,
                    "status": "suggested",
                })

        # 构建输出消息
        msg_lines = [
            f"模式分析完成: 分析了 {sessions_analyzed} 个会话，共 {len(all_tool_calls)} 次工具调用",
            f"发现 {len(qualified)} 个重复模式 (>= {min_occurrences} 次)",
            f"{'='*50}",
        ]

        if auto_approve:
            msg_lines.append(f"已创建 {len(skills_created)} 个技能:")
        else:
            msg_lines.append(f"发现 {len(skills_created)} 个可创建的技能建议 (auto_approve=false，未实际创建):")

        for s in skills_created:
            status_label = "已创建" if s["status"] == "created" else "建议创建"
            msg_lines.append(f"  [{status_label}] {s['name']}")
            msg_lines.append(f"    模式: {s['pattern_description']}")
            msg_lines.append(f"    出现次数: {s['occurrence_count']}")

        if skills_skipped:
            msg_lines.append(f"\n跳过 {len(skills_skipped)} 个:")
            for s in skills_skipped:
                msg_lines.append(f"  [跳过] {s['name']}: {s['reason']}")

        if not auto_approve and skills_created:
            msg_lines.append(f"\n提示: 设置 auto_approve=true 可自动创建这些技能。")

        return success_response(
            data={
                "sessions_analyzed": sessions_analyzed,
                "total_tool_calls": len(all_tool_calls),
                "patterns_found": len(qualified),
                "skills_created": skills_created,
                "skills_skipped": skills_skipped,
                "auto_approve": auto_approve,
            },
            message=nl.join(msg_lines),
        )
    except Exception as e:
        return error_response(message=f"自动创建技能失败: {e}", code="AUTO_CREATE_ERROR")
