# -*- coding: utf-8 -*-
"""读取文件内容（支持文本文件，大文件自动截断）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="read_file",
        description="读取文件内容（支持文本文件，大文件自动截断）",
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件绝对路径"},
                "offset": {"type": "integer", "default": 0, "description": "起始行号（从0开始）"},
                "limit": {"type": "integer", "default": 500, "description": "最大读取行数"}
            },
            "required": ["path"]
        },
        handler=handle,
        tags=["file"],
    )


def handle(args: dict) -> dict:
    """读取文件内容"""
    import os as _os
    fpath = args.get("path", "")
    offset = int(args.get("offset", 0))
    limit = int(args.get("limit", 500))
    if not _os.path.isfile(fpath):
        return error_response(f"文件不存在: {fpath}")
    try:
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        total = len(lines)
        selected = lines[offset:offset + limit]
        content = "".join(selected)
        return success_response(data={
            "path": fpath,
            "total_lines": total,
            "offset": offset,
            "limit": limit,
            "display_range": f"{offset+1}-{min(offset+limit, total)}",
            "content": content,
        })
    except Exception as e:
        return error_response(f"读取文件失败: {e}")
