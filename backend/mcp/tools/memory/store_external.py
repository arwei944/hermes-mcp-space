# -*- coding: utf-8 -*-
"""存储记忆到外部记忆提供者"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="store_memory",
        description="存储记忆到外部记忆提供者",
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "记忆内容"},
                "tags": {"type": "array", "items": {"type": "string"}, "description": "标签列表（可选）"}
            },
            "required": ["content"]
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """存储记忆到外部记忆提供者"""
    content = args.get("content", "")
    if not content:
        return error_response("请提供记忆内容。")
    tags = args.get("tags", [])
    try:
        # 存储到本地 learnings.md 作为默认后端
        from datetime import datetime
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        tag_str = ", ".join(tags) if tags else "untagged"
        entry = f"\n## [{ts}] {tag_str}\n- **内容**: {content}\n"

        from backend.config import get_hermes_home
        memory_file = get_hermes_home() / "external_memory.md"
        memory_file.parent.mkdir(parents=True, exist_ok=True)

        existing = ""
        if memory_file.exists():
            existing = memory_file.read_text(encoding="utf-8")
        memory_file.write_text(existing + entry, encoding="utf-8")

        return success_response(message=f"记忆已存储。\n标签: {tag_str}\n内容: {content[:100]}\n存储位置: external_memory.md")
    except Exception as e:
        return error_response(str(e))
