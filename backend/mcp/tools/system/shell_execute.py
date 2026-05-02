# -*- coding: utf-8 -*-
"""执行 shell 命令并返回输出（有超时和输出大小限制）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="shell_execute",
        description="执行 shell 命令并返回输出（有超时和输出大小限制）",
        schema={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的命令"},
                "timeout": {"type": "integer", "default": 30, "description": "超时秒数（最大120）"},
                "cwd": {"type": "string", "description": "工作目录"}
            },
            "required": ["command"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """shell_execute handler"""
    import subprocess as _subprocess
    import os as _os

    command = args.get("command", "")
    timeout = min(int(args.get("timeout", 30)), 120)
    cwd = args.get("cwd", "")

    if not command:
        return error_response(
            "请提供命令",
            code="INVALID_ARGS",
        )

    try:
        actual_cwd = cwd or _os.getcwd()
        result = _subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout, cwd=actual_cwd,
            env={**_subprocess.os.environ, "PAGER": "cat"}
        )
        output = result.stdout or ""
        error = result.stderr or ""
        exit_code = result.returncode

        # 截断过长输出
        max_output = 10000
        truncated_output = False
        truncated_error = False
        if len(output) > max_output:
            output = output[:max_output]
            truncated_output = True
        if len(error) > max_output:
            error = error[:max_output]
            truncated_error = True

        # 构建输出部分
        parts = [f"命令: {command}"]
        parts.append(f"工作目录: {actual_cwd}")
        parts.append(f"退出码: {exit_code}")

        if output:
            # 长输出格式化
            output_lines = output.split("\n")
            total_lines = len(output_lines)
            if total_lines > 500:
                display_lines = output_lines[:500]
                output = "\n".join(display_lines)
                output += f"\n\n... (共 {total_lines} 行，显示第 1-500 行)"
            parts.append(f"\n--- stdout ---\n{output}")
            if truncated_output:
                parts.append(f"\n[输出已截断，原始 stdout 共 {len(result.stdout)} 字符]")

        if error:
            parts.append(f"\n--- stderr ---\n{error}")
            if truncated_error:
                parts.append(f"\n[错误已截断，原始 stderr 共 {len(result.stderr)} 字符]")

        # 错误信息增强
        if exit_code == 127:
            cmd_name = command.strip().split()[0] if command.strip() else "未知"
            parts.append(f"\n⚠️ 命令 '{cmd_name}' 不存在")
            parts.append("建议：")
            parts.append(f"1. 检查命令拼写是否正确（常见拼写错误：'sl' → 'ls'，'cd..' → 'cd ..'）")
            parts.append(f"2. 使用 'which {cmd_name}' 或 'command -v {cmd_name}' 确认命令是否已安装")
            parts.append(f"3. 如果需要安装，尝试：apt install {cmd_name} / brew install {cmd_name} / pip install {cmd_name}")
            parts.append(f"4. 如果是 Python 包，尝试：pip install $(echo {cmd_name} | tr '-' '_')")
        elif exit_code == 126:
            parts.append("\n⚠️ 权限不足，无法执行命令")
            parts.append("建议：")
            parts.append("1. 使用 sudo 重新执行命令（如 sudo apt update）")
            parts.append("2. 检查文件权限：ls -la <命令路径>")
            parts.append("3. 如果是脚本文件，添加执行权限：chmod +x <文件路径>")
            parts.append("4. 确认当前用户是否在正确的用户组中")
        elif exit_code != 0:
            parts.append(f"\n⚠️ 命令执行失败（退出码 {exit_code}）")
            if error:
                error_lines = [l.strip() for l in error.strip().split("\n") if l.strip()]
                if error_lines:
                    parts.append(f"错误摘要: {error_lines[-1]}")
            parts.append("建议：")
            parts.append("1. 检查命令参数是否正确")
            parts.append("2. 查看上方 stderr 输出中的详细错误信息")
            parts.append("3. 尝试使用 --help 或 -h 查看命令帮助")
            parts.append("4. 如果是编译/构建错误，检查依赖是否完整安装")

        return success_response("\n".join(parts))
    except _subprocess.TimeoutExpired:
        return error_response(
            f"命令执行超时（{timeout}秒）\n建议：\n1. 将命令拆分为多个较短的子命令分步执行\n2. 增加 timeout 参数值（最大支持 120 秒）\n3. 如果是长时间运行的任务，考虑使用 nohup 或 screen 在后台执行",
            code="TIMEOUT",
        )
    except Exception as e:
        return error_response(
            f"命令执行失败: {e}\n建议：\n1. 检查命令语法是否正确，尤其是引号、管道符和分号的使用\n2. 确认命令所需的依赖和程序已安装（使用 which 或 command -v 检查）\n3. 查看 stderr 输出中的具体错误信息以定位问题",
            code="EXEC_ERROR",
        )
