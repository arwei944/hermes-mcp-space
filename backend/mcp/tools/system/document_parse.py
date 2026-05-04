# -*- coding: utf-8 -*-
"""文档解析工具 - 解析各种格式的文档并提取文本内容"""

import json
import os
import re
import subprocess

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="document_parse",
        description="解析文档并提取文本内容，支持 Markdown、TXT、JSON、CSV、Python、JS、HTML、PDF 等格式",
        schema={
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "文档文件路径",
                },
                "format": {
                    "type": "string",
                    "description": "文档格式（可选，默认根据扩展名自动检测）",
                },
                "pages": {
                    "type": "string",
                    "description": "PDF 页码范围，如 '1-3' 或 '1,3,5'（可选，仅 PDF 有效）",
                },
            },
            "required": ["file_path"],
        },
        handler=handle,
        tags=["system"],
    )


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _detect_format(file_path: str) -> str:
    """根据文件扩展名检测格式"""
    ext = os.path.splitext(file_path)[1].lower()
    format_map = {
        ".md": "markdown",
        ".markdown": "markdown",
        ".txt": "text",
        ".json": "json",
        ".csv": "csv",
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".html": "html",
        ".htm": "html",
        ".xml": "xml",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".pdf": "pdf",
        ".log": "text",
        ".cfg": "text",
        ".ini": "text",
        ".toml": "toml",
        ".sql": "sql",
        ".sh": "shell",
        ".bash": "shell",
        ".zsh": "shell",
    }
    return format_map.get(ext, "text")


def _read_text_file(file_path: str) -> str:
    """读取纯文本文件，尝试多种编码"""
    encodings = ["utf-8", "utf-8-sig", "gbk", "gb2312", "latin-1"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError(f"无法以支持的编码读取文件: {file_path}")


def _parse_pdf_pdftotext(file_path: str, pages: str = None) -> str:
    """使用 pdftotext 命令行工具解析 PDF"""
    cmd = ["pdftotext", "-layout", "-enc", "UTF-8"]
    if pages:
        if "-" in pages:
            parts = pages.split("-")
            if len(parts) == 2:
                cmd.extend(["-f", parts[0].strip(), "-l", parts[1].strip()])
        elif "," in pages:
            page_nums = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]
            if page_nums:
                cmd.extend(["-f", str(min(page_nums)), "-l", str(max(page_nums))])
        else:
            cmd.extend(["-f", pages.strip(), "-l", pages.strip()])

    cmd.extend([file_path, "-"])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"pdftotext 执行失败: {result.stderr}")
    return result.stdout


def _parse_pdf_pdfplumber(file_path: str, pages: str = None) -> str:
    """使用 pdfplumber 库解析 PDF"""
    import pdfplumber

    page_list = None
    if pages:
        if "-" in pages:
            parts = pages.split("-")
            start = int(parts[0].strip()) - 1
            end = int(parts[1].strip())
            page_list = list(range(start, end))
        elif "," in pages:
            page_list = [int(p.strip()) - 1 for p in pages.split(",") if p.strip().isdigit()]
        else:
            page_list = [int(pages.strip()) - 1]

    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        if page_list is not None:
            pdf_pages = [pdf.pages[i] for i in page_list if 0 <= i < len(pdf.pages)]
        else:
            pdf_pages = pdf.pages

        for i, page in enumerate(pdf_pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(f"--- 第 {i + 1} 页 ---\n{page_text}")

    return "\n\n".join(text_parts)


def _parse_pdf(file_path: str, pages: str = None) -> str:
    """解析 PDF 文件，尝试多种方式"""
    # 方式 1: pdftotext 命令行
    try:
        return _parse_pdf_pdftotext(file_path, pages)
    except (FileNotFoundError, RuntimeError):
        pass

    # 方式 2: pdfplumber
    try:
        return _parse_pdf_pdfplumber(file_path, pages)
    except ImportError:
        pass

    raise RuntimeError(
        "PDF 解析失败：需要安装 pdftotext（系统命令）或 pdfplumber（pip install pdfplumber）"
    )


def _parse_csv(file_path: str) -> str:
    """解析 CSV 文件为可读文本"""
    import csv as csv_mod

    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv_mod.reader(f)
        rows = list(reader)

    if not rows:
        return "(空 CSV 文件)"

    col_widths = []
    for row in rows:
        for i, cell in enumerate(row):
            width = len(str(cell))
            if i >= len(col_widths):
                col_widths.append(width)
            else:
                col_widths[i] = max(col_widths[i], width)

    lines = []
    for idx, row in enumerate(rows):
        if idx == 0:
            line = " | ".join(
                str(cell).ljust(col_widths[i] if i < len(col_widths) else 10)
                for i, cell in enumerate(row)
            )
            lines.append(line)
            sep = "-+-".join(
                "-" * (col_widths[i] if i < len(col_widths) else 10)
                for i in range(len(row))
            )
            lines.append(sep)
        else:
            line = " | ".join(
                str(cell).ljust(col_widths[i] if i < len(col_widths) else 10)
                for i, cell in enumerate(row)
            )
            lines.append(line)

    return "\n".join(lines)


def _parse_json(file_path: str) -> str:
    """解析 JSON 文件为可读文本"""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return json.dumps(data, ensure_ascii=False, indent=2)


def _parse_html(file_path: str) -> str:
    """解析 HTML 文件，提取纯文本"""
    content = _read_text_file(file_path)
    content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r"<[^>]+>", " ", content)
    content = content.replace("&nbsp;", " ")
    content = content.replace("&lt;", "<")
    content = content.replace("&gt;", ">")
    content = content.replace("&amp;", "&")
    content = content.replace("&quot;", '"')
    content = re.sub(r"\s+", " ", content).strip()
    return content


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def handle(args: dict) -> dict:
    """document_parse handler"""
    file_path = args.get("file_path", "")
    fmt = args.get("format", "")
    pages = args.get("pages", "")

    if not file_path:
        return error_response("请提供文件路径")

    if not os.path.isfile(file_path):
        return error_response(f"文件不存在: {file_path}")

    try:
        detected_format = fmt.lower() if fmt else _detect_format(file_path)

        if detected_format == "pdf":
            text = _parse_pdf(file_path, pages or None)
        elif detected_format in (
            "markdown", "text", "python", "javascript", "typescript",
            "shell", "sql", "toml", "yaml", "xml", "log",
        ):
            text = _read_text_file(file_path)
        elif detected_format == "html":
            text = _parse_html(file_path)
        elif detected_format == "csv":
            text = _parse_csv(file_path)
        elif detected_format == "json":
            text = _parse_json(file_path)
        else:
            text = _read_text_file(file_path)

        file_size = os.path.getsize(file_path)
        result = {
            "file_path": file_path,
            "format": detected_format,
            "file_size": file_size,
            "content_length": len(text),
            "content": text,
        }

        return success_response(data=result, message=f"文档解析成功（格式: {detected_format}）")

    except Exception as e:
        return error_response(str(e))
