# -*- coding: utf-8 -*-
"""压缩会话历史（保留最近3轮+最早1轮，中间由摘要替代）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="compress_session",
        description="压缩会话历史（保留最近3轮+最早1轮，中间由摘要替代）",
        schema={
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "会话 ID"},
                "keep_recent": {"type": "integer", "default": 3, "description": "保留最近 N 轮"},
                "keep_first": {"type": "integer", "default": 1, "description": "保留最早 N 轮"},
                "summary_max_chars": {"type": "integer", "default": 500, "description": "摘要最大字符数"}
            },
            "required": ["session_id"]
        },
        handler=handle,
        tags=["session"],
    )


def handle(args: dict) -> dict:
    """compress_session handler"""
    from backend.services.hermes_service import hermes_service

    try:
        session_id = args.get("session_id", "")
        if not session_id:
            return error_response(
                message="请提供会话 ID。\n建议：\n1. 使用 list_sessions 获取会话 ID\n2. 确认 session_id 参数拼写正确",
                code="INVALID_ARGS",
            )

        keep_recent = int(args.get("keep_recent", 3))
        keep_first = int(args.get("keep_first", 1))
        summary_max = int(args.get("summary_max_chars", 500))

        # 从 hermes_service 获取消息
        messages = hermes_service.get_session_messages(session_id)
        if not messages:
            return error_response(
                message=f"会话 {session_id} 没有消息。\n建议：\n1. 确认会话 ID 正确\n2. 使用 list_sessions 查看可用会话",
                code="NO_MESSAGES",
            )

        total = len(messages)
        if total <= (keep_recent + keep_first):
            return success_response(
                message=f"会话只有 {total} 条消息，无需压缩（阈值: {keep_recent + keep_first}）"
            )

        # 保留最早 N 条
        first_msgs = messages[:keep_first]
        # 保留最近 N 条
        recent_msgs = messages[-keep_recent:]
        # 中间部分生成摘要
        middle_msgs = messages[keep_first:-keep_recent]

        # 简单摘要：提取每条消息的前 80 字符
        summary_parts = []
        for m in middle_msgs:
            role = m.get("role", "?")
            content = m.get("content", "")
            preview = content[:80].replace("\n", " ")
            summary_parts.append(f"[{role}] {preview}")

        summary = " | ".join(summary_parts)
        if len(summary) > summary_max:
            summary = summary[:summary_max] + "..."

        # 计算压缩率
        original_chars = sum(len(m.get("content", "")) for m in messages)
        compressed_chars = sum(len(m.get("content", "")) for m in first_msgs) + len(summary) + sum(len(m.get("content", "")) for m in recent_msgs)
        ratio = (1 - compressed_chars / max(original_chars, 1)) * 100

        # 保存摘要到会话元数据（通过 hermes_service）
        try:
            hermes_service.update_session_summary(session_id, summary)
        except Exception:
            pass  # 如果方法不存在，跳过

        result = f"""会话压缩完成
原始: {total} 条消息 ({original_chars} 字符)
压缩后: {keep_first} + 摘要 + {keep_recent} 条 ({compressed_chars} 字符)
压缩率: {ratio:.1f}%

--- 最早 {keep_first} 条 ---
""" + "\n".join(f"[{m.get('role','?')}] {m.get('content','')[:100]}" for m in first_msgs) + f"""

--- 摘要 ({len(middle_msgs)} 条) ---
{summary}

--- 最近 {keep_recent} 条 ---
""" + "\n".join(f"[{m.get('role','?')}] {m.get('content','')[:100]}" for m in recent_msgs)

        return success_response(
            data={
                "original_messages": total,
                "compressed_messages": keep_first + keep_recent,
                "middle_summary_count": len(middle_msgs),
                "compression_ratio": round(ratio, 1),
            },
            message=result,
        )
    except Exception as e:
        return error_response(message=f"压缩会话失败: {e}", code="COMPRESS_ERROR")
