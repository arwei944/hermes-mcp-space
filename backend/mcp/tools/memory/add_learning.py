# -*- coding: utf-8 -*-
"""添加一条学习记录（记录工具使用中的发现）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="add_learning",
        description="添加一条学习记录（记录工具使用中的发现）",
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "学习内容"},
                "tool": {"type": "string", "description": "相关工具名（可选）"},
                "error": {"type": "string", "description": "相关错误（可选）"}
            },
            "required": ["content"]
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """添加一条学习记录"""
    import os as _os
    from datetime import datetime, timezone
    content = args.get("content", "")
    if not content:
        return error_response("请提供学习内容")
    tool_name = args.get("tool", "")
    error_info = args.get("error", "")

    try:
        from backend.config import get_hermes_home
        learnings_path = get_hermes_home() / "learnings.md"
    except Exception:
        learnings_path = _os.path.expanduser("~/.hermes/learnings.md")

    try:
        _os.makedirs(_os.path.dirname(learnings_path), exist_ok=True)

        # 构建新条目
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        entry_lines = [f"\n## [{now}] {tool_name}"]
        entry_lines.append(f"- **内容**: {content}")
        if tool_name:
            entry_lines.append(f"- **工具**: {tool_name}")
        if error_info:
            entry_lines.append(f"- **错误**: {error_info}")
        new_entry = "\n".join(entry_lines) + "\n"

        # 读取现有内容并检查条数
        existing = ""
        if _os.path.isfile(learnings_path):
            with open(learnings_path, "r", encoding="utf-8", errors="replace") as f:
                existing = f.read()

        # 计算现有条数
        entry_count = existing.count("\n## ")

        # 超过 50 条时删除最旧的条目
        if entry_count >= 50:
            # 找到第一个条目（最旧的）并删除
            first_entry_end = existing.find("\n## ", 1)
            if first_entry_end != -1:
                existing = existing[first_entry_end:]
            else:
                existing = ""

        # 写入
        with open(learnings_path, "w", encoding="utf-8") as f:
            f.write(existing + new_entry)

        return success_response(message=f"学习记录已添加 ({tool_name or '通用'})")
    except Exception as e:
        return error_response(str(e))
