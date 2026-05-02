# -*- coding: utf-8 -*-
"""在目录中搜索包含指定内容的文件"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="search_files",
        description="在目录中搜索包含指定内容的文件",
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "搜索根目录"},
                "pattern": {"type": "string", "description": "搜索内容（正则表达式）"},
                "file_pattern": {"type": "string", "description": "文件过滤（如 *.py）"},
                "max_results": {"type": "integer", "default": 20, "description": "最大结果数"}
            },
            "required": ["path", "pattern"]
        },
        handler=handle,
        tags=["file"],
    )


def handle(args: dict) -> dict:
    """在目录中搜索包含指定内容的文件"""
    import os as _os
    root = args.get("path", "")
    pattern = args.get("pattern", "")
    file_pattern = args.get("file_pattern", "")
    max_results = int(args.get("max_results", 20))
    if not _os.path.isdir(root):
        return error_response(f"目录不存在: {root}")
    try:
        import re as _re
        import glob as _glob
        regex = _re.compile(pattern)
        results = []
        # 收集文件
        if file_pattern:
            files = []
            for ext in _glob.glob(_os.path.join(root, "**", file_pattern), recursive=True):
                if _os.path.isfile(ext):
                    files.append(ext)
        else:
            files = []
            for dirpath, dirnames, filenames in _os.walk(root):
                for fn in filenames:
                    files.append(_os.path.join(dirpath, fn))
        # 搜索
        for fpath in files:
            if len(results) >= max_results:
                break
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    for i, line in enumerate(f, 1):
                        if regex.search(line):
                            results.append({
                                "file": fpath,
                                "line": i,
                                "content": line.strip()[:120],
                            })
                            if len(results) >= max_results:
                                break
            except Exception:
                continue
        return success_response(data={
            "pattern": pattern,
            "root": root,
            "total_matches": len(results),
            "results": results,
        })
    except Exception as e:
        return error_response(f"搜索失败: {e}")
