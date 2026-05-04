# -*- coding: utf-8 -*-
"""文档格式转换工具 - 在 HTML、Markdown、纯文本、JSON 等格式之间转换"""

import json
import os
import re
import subprocess
import uuid

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="document_convert",
        description="在文档格式之间转换，支持 Markdown 转 HTML、HTML 转纯文本、JSON 转 Markdown 等操作",
        schema={
            "type": "object",
            "properties": {
                "input_path": {
                    "type": "string",
                    "description": "输入文件路径",
                },
                "output_format": {
                    "type": "string",
                    "enum": ["html", "markdown", "text", "json"],
                    "description": "目标输出格式",
                },
                "output_path": {
                    "type": "string",
                    "description": "输出文件路径（可选，默认自动生成）",
                },
            },
            "required": ["input_path", "output_format"],
        },
        handler=handle,
        tags=["system"],
    )


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _detect_input_format(file_path: str) -> str:
    """根据文件扩展名检测输入格式"""
    ext = os.path.splitext(file_path)[1].lower()
    format_map = {
        ".md": "markdown",
        ".markdown": "markdown",
        ".html": "html",
        ".htm": "html",
        ".txt": "text",
        ".json": "json",
        ".csv": "csv",
    }
    return format_map.get(ext, "text")


def _read_file(file_path: str) -> str:
    """读取文件内容，尝试多种编码"""
    encodings = ["utf-8", "utf-8-sig", "gbk", "latin-1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError(f"无法读取文件: {file_path}")


def _get_output_path(input_path: str, output_format: str, output_path: str = None) -> str:
    """获取输出文件路径"""
    if output_path:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        return output_path

    from backend.config import get_hermes_home
    output_dir = get_hermes_home() / "data" / "converted"
    output_dir.mkdir(parents=True, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(input_path))[0]
    ext_map = {"html": ".html", "markdown": ".md", "text": ".txt", "json": ".json"}
    ext = ext_map.get(output_format, ".txt")
    filename = f"{base_name}_{uuid.uuid4().hex[:6]}{ext}"
    return str(output_dir / filename)


def _inline_format(text: str) -> str:
    """处理行内格式：粗体、斜体、行内代码、链接"""
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    return text


def _markdown_to_html_simple(md_text: str) -> str:
    """使用正则进行简单的 Markdown 转 HTML"""
    lines = md_text.split("\n")
    html_lines = []
    in_code_block = False
    in_list = False

    for line in lines:
        if line.strip().startswith("```"):
            if in_code_block:
                html_lines.append("</code></pre>")
                in_code_block = False
            else:
                lang = line.strip()[3:].strip()
                html_lines.append(f'<pre><code class="language-{lang}">')
                in_code_block = True
            continue

        if in_code_block:
            html_lines.append(line)
            continue

        if line.startswith("###### "):
            html_lines.append(f"<h6>{_inline_format(line[7:])}</h6>")
        elif line.startswith("##### "):
            html_lines.append(f"<h5>{_inline_format(line[6:])}</h5>")
        elif line.startswith("#### "):
            html_lines.append(f"<h4>{_inline_format(line[5:])}</h4>")
        elif line.startswith("### "):
            html_lines.append(f"<h3>{_inline_format(line[4:])}</h3>")
        elif line.startswith("## "):
            html_lines.append(f"<h2>{_inline_format(line[3:])}</h2>")
        elif line.startswith("# "):
            html_lines.append(f"<h1>{_inline_format(line[2:])}</h1>")
        elif re.match(r"^---+$", line.strip()):
            html_lines.append("<hr>")
        elif re.match(r"^[\-\*] ", line):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            html_lines.append(f"<li>{_inline_format(line[2:])}</li>")
        else:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            if line.strip():
                html_lines.append(f"<p>{_inline_format(line)}</p>")
            else:
                html_lines.append("")

    if in_list:
        html_lines.append("</ul>")

    return "\n".join(html_lines)


def _markdown_to_html(md_text: str) -> str:
    """Markdown 转 HTML，优先使用 markdown 库，降级到正则"""
    # 方式 1: 使用 markdown 库
    try:
        import markdown
        return markdown.markdown(md_text, extensions=["tables", "fenced_code"])
    except ImportError:
        pass

    # 方式 2: 使用 subprocess 调用 python markdown
    try:
        result = subprocess.run(
            ["python3", "-c", (
                "import sys, markdown; "
                "sys.stdout.write(markdown.markdown("
                "sys.stdin.read(), extensions=['tables', 'fenced_code']))"
            )],
            input=md_text,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout
    except Exception:
        pass

    # 方式 3: 简单正则转换
    return _markdown_to_html_simple(md_text)


def _html_to_text(html_text: str) -> str:
    """HTML 转纯文本"""
    text = re.sub(r"<script[^>]*>.*?</script>", "", html_text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(p|div|h[1-6]|li|tr|blockquote)[^>]*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&amp;", "&")
    text = text.replace("&quot;", '"')
    text = text.replace("&#39;", "'")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _text_to_html(text: str) -> str:
    """纯文本转 HTML"""
    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    paragraphs = escaped.split("\n\n")
    html_parts = [f"<p>{p.replace(chr(10), '<br>')}</p>" for p in paragraphs if p.strip()]
    return "\n".join(html_parts)


def _json_to_markdown(json_text: str) -> str:
    """JSON 转 Markdown 表格"""
    data = json.loads(json_text)

    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        headers = list(data[0].keys())
        lines = []
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for item in data:
            row = [str(item.get(h, "")) for h in headers]
            lines.append("| " + " | ".join(row) + " |")
        return "\n".join(lines)
    elif isinstance(data, dict):
        lines = []
        for key, value in data.items():
            lines.append(f"- **{key}**: {json.dumps(value, ensure_ascii=False)}")
        return "\n".join(lines)
    else:
        return f"```json\n{json.dumps(data, ensure_ascii=False, indent=2)}\n```"


def _csv_to_markdown(csv_text: str) -> str:
    """CSV 转 Markdown 表格"""
    import csv as csv_mod
    import io

    reader = csv_mod.reader(io.StringIO(csv_text))
    rows = list(reader)
    if not rows:
        return "(空 CSV 数据)"

    lines = []
    lines.append("| " + " | ".join(rows[0]) + " |")
    lines.append("| " + " | ".join(["---"] * len(rows[0])) + " |")
    for row in rows[1:]:
        padded = row + [""] * (len(rows[0]) - len(row))
        lines.append("| " + " | ".join(padded[:len(rows[0])]) + " |")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def handle(args: dict) -> dict:
    """document_convert handler"""
    input_path = args.get("input_path", "")
    output_format = args.get("output_format", "")
    output_path = args.get("output_path", "")

    if not input_path:
        return error_response("请提供输入文件路径")
    if not output_format:
        return error_response("请提供输出格式")

    valid_formats = ["html", "markdown", "text", "json"]
    if output_format not in valid_formats:
        return error_response(f"不支持的输出格式: {output_format}，可选: {valid_formats}")

    if not os.path.isfile(input_path):
        return error_response(f"输入文件不存在: {input_path}")

    try:
        input_format = _detect_input_format(input_path)
        content = _read_file(input_path)
        save_path = _get_output_path(input_path, output_format, output_path or None)

        if input_format == "markdown" and output_format == "html":
            result_content = _markdown_to_html(content)
        elif input_format == "html" and output_format == "text":
            result_content = _html_to_text(content)
        elif input_format == "text" and output_format == "html":
            result_content = _text_to_html(content)
        elif input_format == "json" and output_format == "markdown":
            result_content = _json_to_markdown(content)
        elif input_format == "csv" and output_format == "markdown":
            result_content = _csv_to_markdown(content)
        elif input_format == "html" and output_format == "markdown":
            text = _html_to_text(content)
            result_content = text
        elif input_format == "text" and output_format == "markdown":
            result_content = content
        elif input_format == "text" and output_format == "json":
            result_content = json.dumps({"content": content}, ensure_ascii=False, indent=2)
        else:
            result_content = content

        with open(save_path, "w", encoding="utf-8") as f:
            f.write(result_content)

        preview = result_content[:500]
        if len(result_content) > 500:
            preview += "..."

        return success_response(
            data={
                "input_path": input_path,
                "input_format": input_format,
                "output_path": save_path,
                "output_format": output_format,
                "content_length": len(result_content),
                "preview": preview,
            },
            message=f"文档转换完成: {input_format} -> {output_format}，已保存到: {save_path}",
        )

    except Exception as e:
        return error_response(str(e))
