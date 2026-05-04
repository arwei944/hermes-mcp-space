# -*- coding: utf-8 -*-
"""Hermes Agent — 自动知识沉淀引擎 v2

核心职责：每次工具调用后，自动从结果中提炼知识/经验/记忆，写入 knowledge.db
取代旧版 auto_learner.py（只写 learnings.md，不进 DB）

沉淀策略：
  - web_search/web_fetch → 提取关键事实 → knowledge
  - shell_execute 失败 → 错误模式 → experience
  - shell_execute 成功且有高价值输出 → 发现 → knowledge
  - log_conversation → 用户偏好 → memory
  - 任何工具失败 → 经验记录 → experience
  - 高频工具组合 → 最佳实践 → knowledge
"""

import json
import logging
import re
import threading
import time
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes-mcp")
_lock = threading.Lock()
_last_learn_ts: float = 0
_COOLDOWN = 30  # 30 秒冷却（旧版 300 太长）

# 工具分类：哪些工具的输出值得沉淀
_SINK_TOOLS = {
    "web_search": "knowledge",       # 搜索结果 → 知识
    "web_fetch": "knowledge",        # 网页内容 → 知识
    "shell_execute": "dual",         # 成功→知识，失败→经验
    "safe_shell_execute": "dual",
    "github_operations": "knowledge", # GitHub 操作结果 → 知识
    "document_parse": "knowledge",    # 文档解析 → 知识
    "db_query": "knowledge",          # 数据库查询结果 → 知识
    "log_conversation": "memory",     # 对话记录 → 记忆
    "read_file": "knowledge",         # 文件内容 → 知识（仅当内容有结构化信息时）
}

# 高价值输出模式（判断 shell 输出是否值得存为知识）
_HIGH_VALUE_PATTERNS = [
    r"version\s*[:=]\s*\S+",           # 版本信息
    r"\d+\.\d+\.\d+",                  # 语义版本号
    r"(error|warning|fail|success)",    # 操作结果
    r"(config|setting|option)",         # 配置信息
    r"(installed|removed|updated)",     # 包管理结果
    r"(created|deleted|modified)",      # 文件操作结果
    r"TODO|FIXME|NOTE|IMPORTANT",       # 标记
    r"(api|endpoint|route|url)",        # API 信息
    r"(key|token|secret|password)",     # 凭证相关（脱敏后存储）
]

# 用户偏好检测模式
_PREFERENCE_PATTERNS = [
    (r"(我喜欢|偏好|习惯|常用|通常).{0,30}(的|是|用)", "用户偏好"),
    (r"(不要|别|避免|禁止).{0,30}(的|用|做)", "用户禁忌"),
    (r"(项目|代码|技术栈).{0,30}(用|使用|基于|采用)", "项目上下文"),
    (r"(语言|风格|格式|规范).{0,30}(用|使用|遵循)", "代码规范"),
    (r"(部署|环境|配置).{0,30}(在|是|用)", "环境信息"),
]


class AutoLearnEngine:
    """自动知识沉淀引擎 — 从工具调用结果中提炼知识并写入 DB"""

    def __init__(self):
        self._ks = None  # KnowledgeService 延迟加载

    @property
    def ks(self):
        """延迟加载 KnowledgeService（避免循环导入）"""
        if self._ks is None:
            from backend.services.knowledge_service import KnowledgeService
            self._ks = KnowledgeService()
        return self._ks

    # ==================== 主入口 ====================

    def learn_from_tool_call(
        self,
        tool_name: str,
        arguments: dict,
        success: bool,
        error: str = None,
        result_summary: str = None,
        agent_id: str = None,
        session_id: str = None,
    ) -> Optional[Dict[str, Any]]:
        """每次工具调用后的自动学习入口

        由 AutoLearnMiddleware 在工具执行后调用。
        根据工具类型和结果，自动沉淀到 knowledge/experience/memory。
        """
        global _last_learn_ts
        now = time.time()
        if now - _last_learn_ts < _COOLDOWN:
            return None
        _last_learn_ts = now

        try:
            sink = _SINK_TOOLS.get(tool_name)
            if not sink:
                return None

            results = []

            if sink == "knowledge":
                r = self._sink_knowledge(tool_name, arguments, success, error, result_summary)
                if r:
                    results.append(r)

            elif sink == "dual":
                if success:
                    r = self._sink_knowledge(tool_name, arguments, True, None, result_summary)
                    if r:
                        results.append(r)
                else:
                    r = self._sink_experience(tool_name, arguments, error)
                    if r:
                        results.append(r)

            elif sink == "memory":
                r = self._sink_memory(arguments)
                if r:
                    results.append(r)

            if results:
                logger.info(f"📚 自动沉淀: {tool_name} → {len(results)} 条记录")
                return {"recorded": True, "items": results}

        except Exception as e:
            logger.warning(f"自动沉淀失败 [{tool_name}]: {e}")

        return None

    # ==================== 知识沉淀 ====================

    def _sink_knowledge(
        self, tool_name: str, arguments: dict, success: bool,
        error: str, result_summary: str
    ) -> Optional[Dict]:
        """从工具结果中提取知识"""

        if not success or not result_summary:
            return None

        # 限制长度，避免存垃圾
        content = result_summary[:2000].strip()
        if len(content) < 50:
            return None

        # 生成标题
        title = self._generate_title(tool_name, arguments, content)

        # 去重检查：标题相似的不重复存
        if self._is_duplicate_knowledge(title, content):
            return None

        # 确定分类
        category = self._classify_knowledge(tool_name, content)

        # 提取标签
        tags = self._extract_tags(tool_name, arguments)

        # 确定来源
        source = "web_import" if tool_name in ("web_search", "web_fetch") else "ai_learned"

        try:
            item = self.ks.create_knowledge(
                title=title,
                content=content,
                category=category,
                tags=tags,
                source=source,
                source_ref=arguments.get("url", "") or arguments.get("query", "")[:100],
                confidence=0.7,
                created_by="auto_engine",
            )
            logger.info(f"  ✅ 知识: {title[:40]}")
            return {"type": "knowledge", "id": item.get("id")}
        except Exception as e:
            logger.warning(f"  ❌ 知识沉淀失败: {e}")
            return None

    # ==================== 经验沉淀 ====================

    def _sink_experience(
        self, tool_name: str, arguments: dict, error: str
    ) -> Optional[Dict]:
        """从工具失败中提取经验"""

        if not error:
            return None

        error_brief = error[:500].strip()

        # 提取错误类型
        error_type = self._classify_error(error)

        # 生成标题
        cmd = arguments.get("command", "")[:100]
        title = f"{tool_name} 失败: {error_type}"
        if cmd:
            title += f" (命令: {cmd[:30]})"

        # 检查是否已有相同经验
        existing = self._find_similar_experience(tool_name, error_type)
        if existing:
            # 增加出现次数，不重复创建
            self.ks.increment_experience_occurrence(existing["id"])
            logger.info(f"  📈 经验更新: {title[:40]} (第{existing.get('occurrence_count', 1) + 1}次)")
            return {"type": "experience_updated", "id": existing["id"]}

        try:
            item = self.ks.create_experience(
                title=title,
                content=f"工具: {tool_name}\n错误类型: {error_type}\n错误信息: {error_brief}\n参数: {json.dumps(arguments, ensure_ascii=False)[:300]}",
                category="error_pattern",
                context=f"调用参数: {json.dumps(arguments, ensure_ascii=False)[:200]}",
                tool_name=tool_name,
                error_type=error_type,
                severity="high" if "permission" in error_type.lower() or "denied" in error_type.lower() else "medium",
                tags=[tool_name, error_type],
                source="auto_engine",
                created_by="auto_engine",
            )
            logger.info(f"  💡 经验: {title[:40]}")
            return {"type": "experience", "id": item.get("id")}
        except Exception as e:
            logger.warning(f"  ❌ 经验沉淀失败: {e}")
            return None

    # ==================== 记忆沉淀 ====================

    def _sink_memory(self, arguments: dict) -> Optional[Dict]:
        """从对话内容中提取用户偏好和上下文"""

        content = arguments.get("content", "")
        if not content or len(content) < 10:
            return None

        # 检测偏好表述
        detected = []
        for pattern, category in _PREFERENCE_PATTERNS:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                detected.append((category, matches[0]))

        if not detected:
            return None

        # 为每个检测到的偏好创建记忆
        results = []
        for category, match_text in detected[:2]:  # 最多 2 条
            mem_content = f"[{category}] {content[:300]}"
            mem_title = f"{category}: {content[:50]}"

            # 去重
            if self._is_duplicate_memory(mem_title):
                continue

            try:
                item = self.ks.create_memory(
                    content=mem_content,
                    category="preference" if "偏好" in category else "context",
                    title=mem_title,
                    importance=7,
                    tags=[category, "auto_detected"],
                    source="auto_engine",
                    source_ref=arguments.get("session_id", ""),
                    created_by="auto_engine",
                )
                logger.info(f"  🧠 记忆: {mem_title[:40]}")
                results.append({"type": "memory", "id": item.get("id")})
            except Exception as e:
                logger.warning(f"  ❌ 记忆沉淀失败: {e}")

        return results[0] if results else None

    # ==================== 辅助方法 ====================

    def _generate_title(self, tool_name: str, arguments: dict, content: str) -> str:
        """生成知识标题"""
        if tool_name == "web_search":
            query = arguments.get("query", "未知查询")
            return f"搜索结果: {query[:60]}"
        elif tool_name == "web_fetch":
            url = arguments.get("url", "未知 URL")
            return f"网页内容: {url[:60]}"
        elif tool_name == "shell_execute":
            cmd = arguments.get("command", "未知命令")[:50]
            return f"命令输出: {cmd}"
        elif tool_name == "github_operations":
            action = arguments.get("action", "操作")[:30]
            return f"GitHub {action}"
        elif tool_name == "document_parse":
            path = arguments.get("file_path", arguments.get("path", "文档"))[:50]
            return f"文档解析: {path}"
        elif tool_name == "db_query":
            return f"数据库查询结果"
        elif tool_name == "read_file":
            path = arguments.get("path", "文件")[:50]
            return f"文件内容: {path}"
        return f"自动提取: {tool_name}"

    def _classify_knowledge(self, tool_name: str, content: str) -> str:
        """分类知识"""
        if tool_name in ("web_search", "web_fetch"):
            return "reference"
        elif tool_name in ("shell_execute", "safe_shell_execute"):
            if any(re.search(p, content, re.IGNORECASE) for p in _HIGH_VALUE_PATTERNS):
                return "tech"
            return "general"
        elif tool_name == "github_operations":
            return "project"
        elif tool_name == "document_parse":
            return "reference"
        elif tool_name == "db_query":
            return "tech"
        return "general"

    def _extract_tags(self, tool_name: str, arguments: dict) -> List[str]:
        """提取标签"""
        tags = [tool_name, "auto_extracted"]
        if tool_name == "web_search":
            tags.append("search_result")
        elif tool_name == "web_fetch":
            tags.append("web_content")
        elif tool_name in ("shell_execute", "safe_shell_execute"):
            tags.append("command_output")
        return tags

    def _classify_error(self, error: str) -> str:
        """分类错误类型"""
        error_lower = error.lower()
        patterns = [
            (r"ssl", "SSL错误"),
            (r"timeout|timed out", "超时"),
            (r"404|not found", "404未找到"),
            (r"401|unauthorized|permission|denied", "权限不足"),
            (r"500|internal server", "服务器错误"),
            (r"connection refused", "连接拒绝"),
            (r"key\s*error|attribute\s*error", "属性错误"),
            (r"syntax\s*error", "语法错误"),
            (r"type\s*error", "类型错误"),
            (r"import\s*error|module\s*not\s*found", "模块缺失"),
            (r"no such table", "数据库表缺失"),
            (r"no such file", "文件不存在"),
            (r"command not found", "命令不存在"),
        ]
        for pattern, label in patterns:
            if re.search(pattern, error_lower):
                return label
        return error.split("\n")[0].strip()[:30] if error else "未知错误"

    def _is_duplicate_knowledge(self, title: str, content: str) -> bool:
        """检查是否已有相似知识（简单标题匹配）"""
        try:
            results = self.ks.search_knowledge(title[:20], limit=3)
            for r in results:
                if r.get("title", "") == title:
                    return True
        except Exception:
            pass
        return False

    def _is_duplicate_memory(self, title: str) -> bool:
        """检查是否已有相似记忆"""
        try:
            results = self.ks.list_memories(limit=20)
            for r in results:
                if r.get("title", "") == title:
                    return True
        except Exception:
            pass
        return False

    def _find_similar_experience(self, tool_name: str, error_type: str) -> Optional[Dict]:
        """查找相似经验（同工具+同错误类型）"""
        try:
            results = self.ks.list_experiences(limit=50)
            for r in results:
                if (r.get("tool_name") == tool_name
                        and r.get("error_type") == error_type
                        and not r.get("is_resolved")):
                    return r
        except Exception:
            pass
        return None


# 模块级单例
auto_learn_engine = AutoLearnEngine()
