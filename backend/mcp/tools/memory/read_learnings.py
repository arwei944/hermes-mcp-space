# -*- coding: utf-8 -*-
"""读取 Agent 学习记录（从历史经验中学习）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="read_learnings",
        description="读取 Agent 学习记录（从历史经验中学习）",
        schema={
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 20, "description": "返回条数"}
            }
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """读取 Agent 学习记录"""
    import os as _os
    try:
        from backend.config import get_hermes_home
        learnings_path = get_hermes_home() / "learnings.md"
    except Exception:
        learnings_path = _os.path.expanduser("~/.hermes/learnings.md")

    if not _os.path.isfile(learnings_path):
        return success_response(data=None, message="暂无学习记录。使用 add_learning 工具记录工具使用中的发现和经验。")

    try:
        with open(learnings_path, "r", encoding="utf-8", errors="replace") as f:
            full_content = f.read()
        if not full_content.strip():
            return success_response(data=None, message="暂无学习记录。使用 add_learning 工具记录工具使用中的发现和经验。")

        # 按条目分割（## 开头为条目分隔符）
        entries = []
        current_entry = []
        for line in full_content.split("\n"):
            if line.startswith("## ") and current_entry:
                entries.append("\n".join(current_entry))
                current_entry = [line]
            else:
                current_entry.append(line)
        if current_entry:
            entries.append("\n".join(current_entry))

        # 按时间倒序（最新在前）
        entries = entries[::-1]
        limit = int(args.get("limit", 20))
        selected = entries[:limit]

        return success_response(data={
            "total": len(entries),
            "displayed": len(selected),
            "entries": selected,
        })
    except Exception as e:
        return error_response(str(e))
