# -*- coding: utf-8 -*-
"""
Hermes Agent MCP Server - 供 Trae 等 MCP 客户端连接使用
基于 Hermes 原生 MCP 实现，暴露全部工具

支持两种传输方式：
  - stdio: 标准输入/输出，适合本地 IDE 集成（Trae、Cursor 等）
  - sse:   Server-Sent Events，适合远程部署（魔搭 Space 等）

用法：
  python mcp_server.py                          # 默认 stdio 模式
  python mcp_server.py --transport sse           # SSE 模式
  python mcp_server.py --transport sse --port 9000  # 自定义端口
"""

import argparse
import asyncio
import json
import logging
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

# ==================== 日志配置 ====================

LOG_LEVEL = os.environ.get("LOG_LEVEL", "WARNING").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.WARNING),
    format="[%(asctime)s] %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("hermes-mcp")

# ==================== 全局状态 ====================

HERMES_AVAILABLE = False
HERMES_HOME = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))

# 尝试导入 Hermes 核心模块
try:
    import hermes  # type: ignore
    HERMES_AVAILABLE = True
    logger.info("Hermes 核心模块已加载")
except ImportError:
    logger.warning("Hermes 核心模块未找到，将使用降级模式")


# ==================== 工具执行器 ====================

class ToolExecutor:
    """工具执行器 - 封装所有工具的实际执行逻辑

    当 Hermes 可用时，委托给 Hermes 的 ToolRegistry；
    否则使用内置的降级实现。
    """

    def __init__(self):
        self._registry = None
        self._init_registry()

    def _init_registry(self):
        """初始化 Hermes ToolRegistry"""
        if not HERMES_AVAILABLE:
            return
        try:
            if hasattr(hermes, "ToolRegistry"):
                self._registry = hermes.ToolRegistry()
                logger.info("Hermes ToolRegistry 初始化成功")
        except Exception as e:
            logger.warning(f"ToolRegistry 初始化失败: {e}")

    @property
    def is_hermes_mode(self) -> bool:
        """是否处于 Hermes 原生模式"""
        return self._registry is not None

    # ---------- 文件操作 ----------

    def read_file(self, path: str, offset: int = 0, limit: int = 2000) -> str:
        """读取文件内容"""
        try:
            p = Path(path).expanduser()
            if not p.exists():
                return json.dumps({"error": f"文件不存在: {path}"}, ensure_ascii=False)
            lines = p.read_text(encoding="utf-8").splitlines()
            selected = lines[offset:offset + limit]
            return "\n".join(f"{i + offset + 1}\t{line}" for i, line in enumerate(selected))
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    def write_file(self, path: str, content: str) -> str:
        """写入文件"""
        try:
            p = Path(path).expanduser()
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
            return json.dumps({"success": True, "path": str(p)}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    def patch_file(self, path: str, old_str: str, new_str: str) -> str:
        """补丁修改文件"""
        try:
            p = Path(path).expanduser()
            if not p.exists():
                return json.dumps({"error": f"文件不存在: {path}"}, ensure_ascii=False)
            content = p.read_text(encoding="utf-8")
            if old_str not in content:
                return json.dumps({"error": "未找到匹配的文本片段"}, ensure_ascii=False)
            content = content.replace(old_str, new_str, 1)
            p.write_text(content, encoding="utf-8")
            return json.dumps({"success": True, "path": str(p)}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    def search_files(self, pattern: str, directory: str = ".", include: str = "*") -> str:
        """搜索文件内容"""
        try:
            import glob as globmod
            base = Path(directory).expanduser().resolve()
            matches = []
            for filepath in base.rglob(include):
                if filepath.is_file():
                    try:
                        text = filepath.read_text(encoding="utf-8", errors="ignore")
                        for i, line in enumerate(text.splitlines(), 1):
                            if pattern in line:
                                matches.append(f"{filepath}:{i}: {line.strip()}")
                                if len(matches) >= 100:
                                    break
                    except Exception:
                        continue
                if len(matches) >= 100:
                    break
            return "\n".join(matches) if matches else "未找到匹配结果"
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    # ---------- 终端操作 ----------

    def terminal(self, command: str, timeout: int = 120, cwd: Optional[str] = None) -> str:
        """执行终端命令"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd or os.getcwd(),
            )
            output = result.stdout
            if result.stderr:
                output += f"\n[STDERR]\n{result.stderr}"
            if result.returncode != 0:
                output += f"\n[EXIT CODE] {result.returncode}"
            return output[:10000]  # 限制输出长度
        except subprocess.TimeoutExpired:
            return json.dumps({"error": f"命令执行超时 ({timeout}s)"}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    def execute_code(self, code: str, language: str = "python") -> str:
        """执行代码"""
        if language != "python":
            return json.dumps({"error": f"不支持的语言: {language}"}, ensure_ascii=False)
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".py", delete=False, encoding="utf-8"
            ) as f:
                f.write(code)
                f.flush()
                tmp_path = f.name

            result = subprocess.run(
                [sys.executable, tmp_path],
                capture_output=True,
                text=True,
                timeout=60,
            )
            os.unlink(tmp_path)

            output = result.stdout
            if result.stderr:
                output += f"\n[STDERR]\n{result.stderr}"
            return output[:10000]
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    # ---------- 网络操作 ----------

    def web_search(self, query: str, num_results: int = 5) -> str:
        """网页搜索"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("web_search", query=query, num_results=num_results)
            except Exception as e:
                logger.warning(f"Hermes web_search 失败: {e}")

        # 降级实现：使用 httpx 调用搜索 API
        try:
            import httpx
            # 尝试使用 DuckDuckGo 或其他免费搜索 API
            headers = {"User-Agent": "Hermes-MCP/1.0"}
            resp = httpx.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1},
                headers=headers,
                timeout=15,
            )
            data = resp.json()
            results = []
            for topic in data.get("RelatedTopics", [])[:num_results]:
                if "Text" in topic:
                    results.append(topic["Text"])
                elif "FirstURL" in topic:
                    results.append(f"{topic.get('Text', '')} - {topic['FirstURL']}")
            return "\n\n".join(results) if results else "未找到搜索结果"
        except Exception as e:
            return json.dumps({"error": f"搜索失败: {e}"}, ensure_ascii=False)

    def web_extract(self, url: str) -> str:
        """提取网页内容"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("web_extract", url=url)
            except Exception as e:
                logger.warning(f"Hermes web_extract 失败: {e}")

        try:
            import httpx
            from html.parser import HTMLParser

            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self._texts = []
                    self._skip = False

                def handle_starttag(self, tag, attrs):
                    if tag in ("script", "style", "nav", "footer", "header"):
                        self._skip = True

                def handle_endtag(self, tag):
                    if tag in ("script", "style", "nav", "footer", "header"):
                        self._skip = False
                    if tag in ("p", "div", "h1", "h2", "h3", "h4", "li", "br"):
                        self._texts.append("\n")

                def handle_data(self, data):
                    if not self._skip:
                        text = data.strip()
                        if text:
                            self._texts.append(text)

            resp = httpx.get(url, follow_redirects=True, timeout=15, headers={
                "User-Agent": "Hermes-MCP/1.0"
            })
            extractor = TextExtractor()
            extractor.feed(resp.text)
            content = "".join(extractor._texts).strip()
            # 清理多余空行
            lines = [l for l in content.split("\n") if l.strip()]
            return "\n".join(lines)[:8000]
        except Exception as e:
            return json.dumps({"error": f"提取失败: {e}"}, ensure_ascii=False)

    # ---------- 图片操作 ----------

    def vision_analyze(self, image_path: str, prompt: str = "描述这张图片的内容") -> str:
        """图片分析"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("vision_analyze", image_path=image_path, prompt=prompt)
            except Exception as e:
                logger.warning(f"Hermes vision_analyze 失败: {e}")
        return json.dumps({"error": "图片分析需要 Hermes 原生模式"}, ensure_ascii=False)

    def image_generate(self, prompt: str, output_path: str = "") -> str:
        """图片生成"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("image_generate", prompt=prompt, output_path=output_path)
            except Exception as e:
                logger.warning(f"Hermes image_generate 失败: {e}")
        return json.dumps({"error": "图片生成需要 Hermes 原生模式"}, ensure_ascii=False)

    # ---------- 记忆操作 ----------

    def memory_read(self) -> str:
        """读取记忆"""
        memories_dir = Path(HERMES_HOME) / "memories"
        result = {}
        for name in ("MEMORY.md", "USER.md"):
            p = memories_dir / name
            if p.exists():
                try:
                    result[name] = p.read_text(encoding="utf-8")
                except Exception:
                    result[name] = ""
        return json.dumps(result, ensure_ascii=False, indent=2)

    def memory_write(self, key: str, content: str) -> str:
        """写入记忆"""
        memories_dir = Path(HERMES_HOME) / "memories"
        memories_dir.mkdir(parents=True, exist_ok=True)
        filename = key if key.endswith(".md") else f"{key}.md"
        p = memories_dir / filename
        try:
            p.write_text(content, encoding="utf-8")
            return json.dumps({"success": True, "file": str(p)}, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    # ---------- 技能操作 ----------

    def skills_list(self) -> str:
        """列出技能"""
        skills_dir = Path(HERMES_HOME) / "skills"
        if not skills_dir.exists():
            return json.dumps([], ensure_ascii=False)
        skills = []
        for item in skills_dir.iterdir():
            if item.is_dir():
                skills.append({"name": item.name, "path": str(item)})
        return json.dumps(skills, ensure_ascii=False, indent=2)

    def skill_view(self, name: str) -> str:
        """查看技能详情"""
        skill_dir = Path(HERMES_HOME) / "skills" / name
        if not skill_dir.exists():
            return json.dumps({"error": f"技能 '{name}' 不存在"}, ensure_ascii=False)
        skill_md = skill_dir / "SKILL.md"
        content = ""
        if skill_md.exists():
            content = skill_md.read_text(encoding="utf-8")
        return json.dumps({"name": name, "content": content}, ensure_ascii=False, indent=2)

    # ---------- 会话操作 ----------

    def session_search(self, query: str, limit: int = 10) -> str:
        """搜索历史会话"""
        db_path = Path(HERMES_HOME) / "data" / "sessions.db"
        if not db_path.exists():
            return json.dumps({"error": "会话数据库不存在"}, ensure_ascii=False)
        try:
            import sqlite3
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, title, updated_at FROM sessions WHERE title LIKE ? ORDER BY updated_at DESC LIMIT ?",
                (f"%{query}%", limit),
            )
            rows = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return json.dumps(rows, ensure_ascii=False, indent=2, default=str)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    # ---------- 任务管理 ----------

    def delegate_task(self, task: str, context: str = "") -> str:
        """委托子任务"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("delegate_task", task=task, context=context)
            except Exception as e:
                logger.warning(f"Hermes delegate_task 失败: {e}")
        return json.dumps({"error": "任务委托需要 Hermes 原生模式"}, ensure_ascii=False)

    def todo(self, action: str, items: str = "[]") -> str:
        """任务规划"""
        try:
            parsed = json.loads(items)
        except json.JSONDecodeError:
            parsed = []
        todo_path = Path(HERMES_HOME) / "todo.json"
        todo_path.parent.mkdir(parents=True, exist_ok=True)

        if action == "list":
            if todo_path.exists():
                return todo_path.read_text(encoding="utf-8")
            return json.dumps([], ensure_ascii=False)
        elif action == "add":
            existing = []
            if todo_path.exists():
                existing = json.loads(todo_path.read_text(encoding="utf-8"))
            existing.extend(parsed if isinstance(parsed, list) else [parsed])
            todo_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
            return json.dumps({"success": True, "total": len(existing)}, ensure_ascii=False)
        elif action == "clear":
            todo_path.write_text("[]", encoding="utf-8")
            return json.dumps({"success": True}, ensure_ascii=False)
        else:
            return json.dumps({"error": f"未知操作: {action}，支持: list, add, clear"}, ensure_ascii=False)

    # ---------- 定时任务 ----------

    def cronjob_manage(self, action: str, job_id: str = "", config: str = "{}") -> str:
        """定时任务管理"""
        cron_dir = Path(HERMES_HOME) / "cron"
        cron_dir.mkdir(parents=True, exist_ok=True)
        jobs_path = cron_dir / "jobs.json"

        def load_jobs():
            if jobs_path.exists():
                try:
                    return json.loads(jobs_path.read_text(encoding="utf-8"))
                except Exception:
                    return []
            return []

        def save_jobs(jobs):
            jobs_path.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")

        if action == "list":
            return json.dumps(load_jobs(), ensure_ascii=False, indent=2)
        elif action == "add":
            jobs = load_jobs()
            job = json.loads(config)
            from datetime import datetime
            job["id"] = job.get("id", f"job-{datetime.now().strftime('%Y%m%d%H%M%S')}")
            job["created_at"] = datetime.now().isoformat()
            jobs.append(job)
            save_jobs(jobs)
            return json.dumps({"success": True, "job_id": job["id"]}, ensure_ascii=False)
        elif action == "remove":
            jobs = load_jobs()
            new_jobs = [j for j in jobs if j.get("id") != job_id]
            save_jobs(new_jobs)
            return json.dumps({"success": True, "removed": job_id}, ensure_ascii=False)
        else:
            return json.dumps({"error": f"未知操作: {action}，支持: list, add, remove"}, ensure_ascii=False)

    # ---------- 消息操作 ----------

    def send_message(self, recipient: str, content: str, channel: str = "default") -> str:
        """发送消息"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call(
                    "send_message", recipient=recipient, content=content, channel=channel
                )
            except Exception as e:
                logger.warning(f"Hermes send_message 失败: {e}")
        return json.dumps({"error": "消息发送需要 Hermes 原生模式"}, ensure_ascii=False)

    # ---------- 浏览器操作 ----------

    def browser_navigate(self, url: str) -> str:
        """浏览器导航"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("browser_navigate", url=url)
            except Exception as e:
                logger.warning(f"Hermes browser_navigate 失败: {e}")
        return json.dumps({"error": "浏览器操作需要 Hermes 原生模式"}, ensure_ascii=False)

    def browser_click(self, selector: str) -> str:
        """浏览器点击"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("browser_click", selector=selector)
            except Exception as e:
                logger.warning(f"Hermes browser_click 失败: {e}")
        return json.dumps({"error": "浏览器操作需要 Hermes 原生模式"}, ensure_ascii=False)

    def browser_type(self, selector: str, text: str) -> str:
        """浏览器输入"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("browser_type", selector=selector, text=text)
            except Exception as e:
                logger.warning(f"Hermes browser_type 失败: {e}")
        return json.dumps({"error": "浏览器操作需要 Hermes 原生模式"}, ensure_ascii=False)

    def browser_screenshot(self, selector: str = "") -> str:
        """浏览器截图"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call("browser_screenshot", selector=selector)
            except Exception as e:
                logger.warning(f"Hermes browser_screenshot 失败: {e}")
        return json.dumps({"error": "浏览器操作需要 Hermes 原生模式"}, ensure_ascii=False)

    # ---------- 语音操作 ----------

    def text_to_speech(self, text: str, output_path: str = "", voice: str = "default") -> str:
        """文字转语音"""
        if self.is_hermes_mode and hasattr(self._registry, "call"):
            try:
                return self._registry.call(
                    "text_to_speech", text=text, output_path=output_path, voice=voice
                )
            except Exception as e:
                logger.warning(f"Hermes text_to_speech 失败: {e}")
        return json.dumps({"error": "语音合成需要 Hermes 原生模式"}, ensure_ascii=False)


# ==================== 工具定义 ====================

# 每个工具的 JSON Schema 定义
TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "name": "hermes_web_search",
        "description": "搜索互联网，返回相关结果。支持关键词搜索、新闻搜索等。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词",
                },
                "num_results": {
                    "type": "integer",
                    "description": "返回结果数量，默认 5",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "hermes_web_extract",
        "description": "提取指定 URL 的网页内容，返回纯文本。自动去除 HTML 标签和无关内容。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "要提取内容的网页 URL",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "hermes_terminal",
        "description": "在终端中执行命令，返回输出结果。支持任意 Shell 命令。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "要执行的 Shell 命令",
                },
                "timeout": {
                    "type": "integer",
                    "description": "超时时间（秒），默认 120",
                    "default": 120,
                },
                "cwd": {
                    "type": "string",
                    "description": "工作目录，默认为当前目录",
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "hermes_read_file",
        "description": "读取文件内容，支持指定偏移量和行数限制。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径（支持 ~ 展开）",
                },
                "offset": {
                    "type": "integer",
                    "description": "起始行号（从 0 开始），默认 0",
                    "default": 0,
                },
                "limit": {
                    "type": "integer",
                    "description": "读取行数，默认 2000",
                    "default": 2000,
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "hermes_write_file",
        "description": "将内容写入文件。如果文件已存在则覆盖，目录不存在则自动创建。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径（支持 ~ 展开）",
                },
                "content": {
                    "type": "string",
                    "description": "要写入的内容",
                },
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "hermes_patch_file",
        "description": "通过查找替换的方式修改文件内容。找到第一个匹配的文本片段并替换。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "文件路径",
                },
                "old_str": {
                    "type": "string",
                    "description": "要查找的原始文本",
                },
                "new_str": {
                    "type": "string",
                    "description": "替换后的新文本",
                },
            },
            "required": ["path", "old_str", "new_str"],
        },
    },
    {
        "name": "hermes_search_files",
        "description": "在指定目录中搜索包含特定文本的文件，返回匹配的行。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "要搜索的文本模式",
                },
                "directory": {
                    "type": "string",
                    "description": "搜索目录，默认当前目录",
                    "default": ".",
                },
                "include": {
                    "type": "string",
                    "description": "文件名过滤模式（glob），默认 *",
                    "default": "*",
                },
            },
            "required": ["pattern"],
        },
    },
    {
        "name": "hermes_execute_code",
        "description": "执行 Python 代码，返回输出结果。代码在沙箱环境中运行。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "要执行的 Python 代码",
                },
                "language": {
                    "type": "string",
                    "description": "编程语言，目前仅支持 python",
                    "default": "python",
                },
            },
            "required": ["code"],
        },
    },
    {
        "name": "hermes_vision_analyze",
        "description": "分析图片内容，支持识别物体、文字、场景等。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "image_path": {
                    "type": "string",
                    "description": "图片文件路径",
                },
                "prompt": {
                    "type": "string",
                    "description": "分析提示词，默认 '描述这张图片的内容'",
                    "default": "描述这张图片的内容",
                },
            },
            "required": ["image_path"],
        },
    },
    {
        "name": "hermes_image_generate",
        "description": "根据文本描述生成图片。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "图片描述文本",
                },
                "output_path": {
                    "type": "string",
                    "description": "输出文件路径，留空则自动生成",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "hermes_memory_read",
        "description": "读取 Hermes 的记忆文件（MEMORY.md 和 USER.md）。",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "hermes_memory_write",
        "description": "写入或更新 Hermes 的记忆文件。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "记忆文件名（如 MEMORY、USER），自动添加 .md 后缀",
                },
                "content": {
                    "type": "string",
                    "description": "要写入的内容",
                },
            },
            "required": ["key", "content"],
        },
    },
    {
        "name": "hermes_skills_list",
        "description": "列出所有已安装的 Hermes 技能。",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "hermes_skill_view",
        "description": "查看指定技能的详细内容（SKILL.md）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "技能名称",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "hermes_session_search",
        "description": "搜索历史会话记录，按标题模糊匹配。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词",
                },
                "limit": {
                    "type": "integer",
                    "description": "返回结果数量，默认 10",
                    "default": 10,
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "hermes_delegate_task",
        "description": "将子任务委托给 Hermes 的子 Agent 执行。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "任务描述",
                },
                "context": {
                    "type": "string",
                    "description": "附加上下文信息",
                    "default": "",
                },
            },
            "required": ["task"],
        },
    },
    {
        "name": "hermes_todo",
        "description": "任务规划管理。支持列出、添加、清空待办事项。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "description": "操作类型：list（列出）、add（添加）、clear（清空）",
                    "enum": ["list", "add", "clear"],
                },
                "items": {
                    "type": "string",
                    "description": "待办事项列表（JSON 数组），add 操作时使用",
                    "default": "[]",
                },
            },
            "required": ["action"],
        },
    },
    {
        "name": "hermes_cronjob_manage",
        "description": "定时任务管理。支持列出、添加、删除定时任务。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "description": "操作类型：list（列出）、add（添加）、remove（删除）",
                    "enum": ["list", "add", "remove"],
                },
                "job_id": {
                    "type": "string",
                    "description": "任务 ID，remove 操作时使用",
                    "default": "",
                },
                "config": {
                    "type": "string",
                    "description": "任务配置（JSON 对象），add 操作时使用",
                    "default": "{}",
                },
            },
            "required": ["action"],
        },
    },
    {
        "name": "hermes_send_message",
        "description": "通过指定渠道发送消息给指定接收者。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "recipient": {
                    "type": "string",
                    "description": "接收者标识",
                },
                "content": {
                    "type": "string",
                    "description": "消息内容",
                },
                "channel": {
                    "type": "string",
                    "description": "消息渠道，默认 default",
                    "default": "default",
                },
            },
            "required": ["recipient", "content"],
        },
    },
    {
        "name": "hermes_browser_navigate",
        "description": "控制浏览器导航到指定 URL。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "目标 URL",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "hermes_browser_click",
        "description": "在浏览器中点击指定元素。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS 选择器或 XPath",
                },
            },
            "required": ["selector"],
        },
    },
    {
        "name": "hermes_browser_type",
        "description": "在浏览器中的指定元素中输入文本。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS 选择器或 XPath",
                },
                "text": {
                    "type": "string",
                    "description": "要输入的文本",
                },
            },
            "required": ["selector", "text"],
        },
    },
    {
        "name": "hermes_browser_screenshot",
        "description": "对浏览器当前页面或指定元素进行截图。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "selector": {
                    "type": "string",
                    "description": "CSS 选择器，留空则截取整个页面",
                    "default": "",
                },
            },
        },
    },
    {
        "name": "hermes_text_to_speech",
        "description": "将文本转换为语音文件。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "要转换的文本",
                },
                "output_path": {
                    "type": "string",
                    "description": "输出音频文件路径，留空则自动生成",
                    "default": "",
                },
                "voice": {
                    "type": "string",
                    "description": "语音类型，默认 default",
                    "default": "default",
                },
            },
            "required": ["text"],
        },
    },
]

# 工具名 -> 执行方法名的映射
TOOL_METHOD_MAP = {
    "hermes_web_search": "web_search",
    "hermes_web_extract": "web_extract",
    "hermes_terminal": "terminal",
    "hermes_read_file": "read_file",
    "hermes_write_file": "write_file",
    "hermes_patch_file": "patch_file",
    "hermes_search_files": "search_files",
    "hermes_execute_code": "execute_code",
    "hermes_vision_analyze": "vision_analyze",
    "hermes_image_generate": "image_generate",
    "hermes_memory_read": "memory_read",
    "hermes_memory_write": "memory_write",
    "hermes_skills_list": "skills_list",
    "hermes_skill_view": "skill_view",
    "hermes_session_search": "session_search",
    "hermes_delegate_task": "delegate_task",
    "hermes_todo": "todo",
    "hermes_cronjob_manage": "cronjob_manage",
    "hermes_send_message": "send_message",
    "hermes_browser_navigate": "browser_navigate",
    "hermes_browser_click": "browser_click",
    "hermes_browser_type": "browser_type",
    "hermes_browser_screenshot": "browser_screenshot",
    "hermes_text_to_speech": "text_to_speech",
}


# ==================== MCP Server 构建 ====================

def create_mcp_server(verbose: bool = False) -> "FastMCP":
    """创建并配置 FastMCP 服务器实例"""
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP(
        name="Hermes Agent",
        instructions=(
            "Hermes Agent MCP Server - 提供文件操作、终端执行、网页搜索、"
            "图片分析/生成、记忆管理、技能管理、浏览器控制等能力。"
        ),
    )

    executor = ToolExecutor()

    # 注册所有工具
    for tool_def in TOOL_DEFINITIONS:
        tool_name = tool_def["name"]
        method_name = TOOL_METHOD_MAP.get(tool_name)
        if not method_name:
            logger.warning(f"工具 {tool_name} 没有对应的执行方法，跳过")
            continue

        method = getattr(executor, method_name, None)
        if not method:
            logger.warning(f"执行器缺少方法 {method_name}，跳过工具 {tool_name}")
            continue

        # 使用 FastMCP 的 tool 装饰器注册
        mcp.tool(
            name=tool_name,
            description=tool_def["description"],
        )(method)

    return mcp


def print_tool_list():
    """打印可用工具列表"""
    mode = "Hermes 原生模式" if HERMES_AVAILABLE else "降级模式"
    print(f"\n{'='*60}")
    print(f"  Hermes Agent MCP Server")
    print(f"  运行模式: {mode}")
    print(f"  Hermes 主目录: {HERMES_HOME}")
    print(f"  可用工具 ({len(TOOL_DEFINITIONS)} 个):")
    print(f"{'='*60}")
    for i, tool in enumerate(TOOL_DEFINITIONS, 1):
        print(f"  {i:2d}. {tool['name']}")
        print(f"      {tool['description'][:60]}...")
    print(f"{'='*60}\n")


# ==================== 命令行入口 ====================

def main():
    parser = argparse.ArgumentParser(
        description="Hermes Agent MCP Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python mcp_server.py                          # stdio 模式（默认）
  python mcp_server.py --transport sse           # SSE 模式
  python mcp_server.py --transport sse --port 9000
  python mcp_server.py --verbose                 # 详细日志
        """,
    )
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="传输方式（默认: stdio）",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="SSE 模式监听地址（默认: 0.0.0.0）",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="SSE 模式监听端口（默认: 8765）",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="启用详细日志输出",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)

    print_tool_list()

    mcp = create_mcp_server(verbose=args.verbose)

    if args.transport == "stdio":
        logger.info("以 stdio 模式启动 MCP Server...")
        mcp.run(transport="stdio")
    else:
        logger.info(f"以 SSE 模式启动 MCP Server，监听 {args.host}:{args.port}...")
        mcp.run(transport="sse", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
