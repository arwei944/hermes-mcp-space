# -*- coding: utf-8 -*-
"""列出目录内容（文件和子目录）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="list_directory",
        description="列出目录内容（文件和子目录）",
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "目录绝对路径"},
                "pattern": {"type": "string", "description": "glob 过滤模式（如 *.py）"}
            },
            "required": ["path"]
        },
        handler=handle,
        tags=["file"],
    )


def handle(args: dict) -> dict:
    """列出目录内容"""
    import os as _os
    dpath = args.get("path", "")
    pattern = args.get("pattern", "")
    if not _os.path.isdir(dpath):
        return error_response(f"目录不存在: {dpath}")
    try:
        import glob as _glob
        if pattern:
            items = _glob.glob(_os.path.join(dpath, pattern))
        else:
            items = _os.listdir(dpath)
        result = []
        for item in sorted(items):
            full = item if _os.path.isabs(item) else _os.path.join(dpath, item)
            if _os.path.isdir(full):
                result.append({"name": item, "type": "directory"})
            else:
                size = _os.path.getsize(full)
                result.append({"name": item, "type": "file", "size": size})
        return success_response(data={
            "path": dpath,
            "items": result,
            "total": len(result),
        })
    except Exception as e:
        return error_response(f"列出目录失败: {e}")
