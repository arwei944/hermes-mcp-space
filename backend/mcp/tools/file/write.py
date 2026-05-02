# -*- coding: utf-8 -*-
"""写入文件内容（自动创建父目录）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="write_file",
        description="写入文件内容（自动创建父目录）",
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件绝对路径"},
                "content": {"type": "string", "description": "要写入的内容"}
            },
            "required": ["path", "content"]
        },
        handler=handle,
        tags=["file"],
    )


def handle(args: dict) -> dict:
    """写入文件内容"""
    import os as _os
    fpath = args.get("path", "")
    content = args.get("content", "")
    if not fpath:
        return error_response("请提供文件路径")
    try:
        _os.makedirs(_os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        return success_response(message=f"文件已写入: {fpath} ({len(content)} 字符)")
    except Exception as e:
        return error_response(f"写入文件失败: {e}")
