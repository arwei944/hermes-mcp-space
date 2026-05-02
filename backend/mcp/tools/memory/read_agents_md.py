# -*- coding: utf-8 -*-
"""读取项目级指令文件（AGENTS.md / CLAUDE.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="read_agents_md",
        description="读取项目级指令文件（AGENTS.md / CLAUDE.md）",
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "自定义文件路径（可选，默认自动发现）"}
            }
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """read_agents_md handler"""
    import os as _os

    try:
        custom_path = args.get("path", "")
        if custom_path:
            if not _os.path.isfile(custom_path):
                return error_response(
                    message=f"文件不存在: {custom_path}\n建议：\n1. 检查路径拼写是否正确\n2. 使用 list_directory 确认文件位置",
                    code="FILE_NOT_FOUND",
                )
            try:
                with open(custom_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                return success_response(
                    data={"content": content, "path": custom_path, "chars": len(content)},
                    message=f"AGENTS.md ({custom_path}, {len(content)} 字符)\n{'='*50}\n{content}",
                )
            except Exception as e:
                return error_response(message=f"读取文件失败: {e}", code="READ_ERROR")
        else:
            # 按顺序查找：./AGENTS.md → ./CLAUDE.md → ~/.hermes/AGENTS.md
            search_paths = [
                ("./AGENTS.md", "AGENTS.md"),
                ("./CLAUDE.md", "CLAUDE.md"),
            ]
            try:
                from backend.config import get_hermes_home
                hermes_home = get_hermes_home()
                search_paths.append((str(hermes_home / "AGENTS.md"), "~/.hermes/AGENTS.md"))
            except Exception:
                pass

            for fpath, label in search_paths:
                if _os.path.isfile(fpath):
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()
                        return success_response(
                            data={"content": content, "path": fpath, "label": label, "chars": len(content)},
                            message=f"{label} ({fpath}, {len(content)} 字符)\n{'='*50}\n{content}",
                        )
                    except Exception as e:
                        return error_response(message=f"读取 {label} 失败: {e}", code="READ_ERROR")

            return success_response(
                message="未找到 AGENTS.md，使用 write_agents_md 创建。\n\n查找路径（按顺序）：\n1. ./AGENTS.md\n2. ./CLAUDE.md\n3. ~/.hermes/AGENTS.md"
            )
    except Exception as e:
        return error_response(message=f"读取 AGENTS.md 失败: {e}", code="READ_ERROR")
