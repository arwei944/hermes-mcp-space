# -*- coding: utf-8 -*-
"""写入项目级指令文件（AGENTS.md）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="write_agents_md",
        description="写入项目级指令文件（AGENTS.md）",
        schema={
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "项目指令内容（Markdown 格式）"},
                "path": {"type": "string", "description": "写入路径（默认 ~/.hermes/AGENTS.md）"}
            },
            "required": ["content"]
        },
        handler=handle,
        tags=["memory"],
    )


def handle(args: dict) -> dict:
    """write_agents_md handler"""
    import os as _os

    try:
        content = args.get("content", "")
        if not content:
            return error_response(
                message="请提供项目指令内容\n建议：\n1. 在参数 content 中输入项目级指令文本（Markdown 格式）\n2. 内容示例：编码规范、项目结构说明、常用命令等\n3. 可选参数 path 指定写入路径（默认 ~/.hermes/AGENTS.md）",
                code="INVALID_ARGS",
            )

        custom_path = args.get("path", "")
        if custom_path:
            target_path = custom_path
        else:
            try:
                from backend.config import get_hermes_home
                target_path = str(get_hermes_home() / "AGENTS.md")
            except Exception:
                target_path = _os.path.expanduser("~/.hermes/AGENTS.md")

        _os.makedirs(_os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)

        return success_response(
            data={"path": target_path, "chars": len(content)},
            message=f"AGENTS.md 已写入: {target_path} ({len(content)} 字符)",
        )
    except Exception as e:
        return error_response(
            message=f"写入 AGENTS.md 失败: {e}\n建议：\n1. 检查目标目录的写入权限\n2. 确认磁盘空间充足\n3. 尝试使用 path 参数指定其他写入路径",
            code="WRITE_ERROR",
        )
