# -*- coding: utf-8 -*-
"""记忆管理服务

从 HermesService 提取的记忆相关方法，包括：
- MEMORY.md / USER.md 读写
- SOUL.md 读写
- learnings.md 读写
- 会话摘要 / 知识提取 / 经验教训生成
"""

import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import get_hermes_home, get_memories_dir


class MemoryService:
    """记忆管理服务

    管理 MEMORY.md、USER.md、SOUL.md、learnings.md 等上下文文件。
    """

    def __init__(self):
        pass

    # ==================== MEMORY.md / USER.md ====================

    def read_memory(self) -> Dict[str, str]:
        """读取当前记忆（MEMORY.md + USER.md）"""
        memories_dir = get_memories_dir()
        # 动态获取上下文预算限制
        try:
            from backend.services.context_budget_service import ContextBudgetService
            budget_svc = ContextBudgetService()
            budget = budget_svc.get_budget()
            memory_budget = int(budget["total_budget"] * budget["memory_pct"] / 100 * 2)
            user_budget = int(budget["total_budget"] * budget["session_pct"] / 100 * 2)
        except Exception:
            memory_budget = 2200
            user_budget = 1375
        result = {"memory": "", "user": "", "memory_usage": 0, "memory_limit": memory_budget, "user_usage": 0, "user_limit": user_budget}

        memory_md = memories_dir / "MEMORY.md"
        if memory_md.exists():
            try:
                text = memory_md.read_text(encoding="utf-8")
                result["memory"] = text
                result["memory_usage"] = len(text)
            except Exception:
                result["memory"] = ""

        user_md = memories_dir / "USER.md"
        if user_md.exists():
            try:
                text = user_md.read_text(encoding="utf-8")
                result["user"] = text
                result["user_usage"] = len(text)
            except Exception:
                result["user"] = ""

        return result

    def update_memory(self, memory: Optional[str] = None, user: Optional[str] = None) -> Dict[str, Any]:
        """更新记忆文件（含容量管理和去重）"""
        memories_dir = get_memories_dir()
        memories_dir.mkdir(parents=True, exist_ok=True)
        updated = []
        warnings = []

        if memory is not None:
            # 去重：移除连续重复行
            lines = memory.split("\n")
            deduped = []
            prev = ""
            for line in lines:
                stripped = line.strip()
                if stripped and stripped == prev:
                    continue  # 跳过连续重复
                deduped.append(line)
                prev = stripped
            memory = "\n".join(deduped)

            # 容量限制：超出时截断旧内容
            try:
                from backend.services.context_budget_service import ContextBudgetService
                budget_svc = ContextBudgetService()
                budget = budget_svc.get_budget()
                MEMORY_LIMIT = int(budget["total_budget"] * budget["memory_pct"] / 100 * 2)
            except Exception:
                MEMORY_LIMIT = 2200
            if len(memory) > MEMORY_LIMIT:
                warnings.append(f"MEMORY.md 超出 {MEMORY_LIMIT} 字符限制 ({len(memory)})，已截断旧内容")
                memory = memory[-MEMORY_LIMIT:]
                first_newline = memory.find("\n")
                if first_newline > 0:
                    memory = memory[first_newline + 1:]

            (memories_dir / "MEMORY.md").write_text(memory, encoding="utf-8")
            updated.append("MEMORY.md")

        if user is not None:
            # 去重
            lines = user.split("\n")
            deduped = []
            prev = ""
            for line in lines:
                stripped = line.strip()
                if stripped and stripped == prev:
                    continue
                deduped.append(line)
                prev = stripped
            user = "\n".join(deduped)

            # 容量限制
            try:
                from backend.services.context_budget_service import ContextBudgetService
                budget_svc = ContextBudgetService()
                budget = budget_svc.get_budget()
                USER_LIMIT = int(budget["total_budget"] * budget["session_pct"] / 100 * 2)
            except Exception:
                USER_LIMIT = 1375
            if len(user) > USER_LIMIT:
                warnings.append(f"USER.md 超出 {USER_LIMIT} 字符限制 ({len(user)})，已截断旧内容")
                user = user[-USER_LIMIT:]
                first_newline = user.find("\n")
                if first_newline > 0:
                    user = user[first_newline + 1:]

            (memories_dir / "USER.md").write_text(user, encoding="utf-8")
            updated.append("USER.md")

        result = {
            "success": True,
            "message": f"已更新: {', '.join(updated)}",
            "updated_files": updated,
        }
        if warnings:
            result["warnings"] = warnings

        # 返回更新后的内容，便于验证
        if "MEMORY.md" in updated:
            try:
                result["memory"] = (memories_dir / "MEMORY.md").read_text(encoding="utf-8")
            except Exception:
                pass
        if "USER.md" in updated:
            try:
                result["user"] = (memories_dir / "USER.md").read_text(encoding="utf-8")
            except Exception:
                pass

        return result

    # ==================== USER.md 单独读写 ====================

    def read_user_profile(self) -> str:
        """读取用户画像（USER.md）"""
        data = self.read_memory()
        return data.get("user", "无用户画像")

    def write_user_profile(self, content: str) -> Dict[str, Any]:
        """写入用户画像（USER.md）"""
        result = self.update_memory(user=content)
        return result

    # ==================== SOUL.md 读写 ====================

    def read_soul(self) -> str:
        """读取 Agent 人格定义（SOUL.md）"""
        try:
            soul_path = get_hermes_home() / "SOUL.md"
            if soul_path.exists():
                content = soul_path.read_text(encoding="utf-8")
                return f"SOUL.md ({len(content)} 字符)\n{'='*50}\n{content}"
            else:
                return "SOUL.md 尚未创建。使用 write_soul 工具创建 Agent 人格定义。"
        except Exception as e:
            raise ValueError(f"读取 SOUL.md 失败: {e}")

    def write_soul(self, content: str) -> str:
        """写入 Agent 人格定义（SOUL.md）"""
        if not content:
            raise ValueError("请提供人格定义内容")
        try:
            soul_path = get_hermes_home() / "SOUL.md"
            soul_path.parent.mkdir(parents=True, exist_ok=True)
            soul_path.write_text(content, encoding="utf-8")
            return f"SOUL.md 已更新 ({len(content)} 字符)"
        except Exception as e:
            raise ValueError(f"写入 SOUL.md 失败: {e}")

    # ==================== learnings.md 读写 ====================

    def read_learnings(self, limit: int = 20) -> str:
        """读取学习记录（learnings.md）"""
        try:
            learnings_path = get_hermes_home() / "learnings.md"
        except Exception:
            learnings_path = os.path.expanduser("~/.hermes/learnings.md")

        if not os.path.isfile(learnings_path):
            return "暂无学习记录。使用 add_learning 工具记录工具使用中的发现和经验。"

        try:
            with open(learnings_path, "r", encoding="utf-8", errors="replace") as f:
                full_content = f.read()
            if not full_content.strip():
                return "暂无学习记录。使用 add_learning 工具记录工具使用中的发现和经验。"

            # 按条目分割（## 开头为条目分隔符）
            entries = []
            current_entry = []
            for line in full_content.split("\n"):
                if line.startswith("## ") and current_entry:
                    entries.append("\n".join(current_entry))
                    current_entry = [line]
                else:
                    current_entry.append(line)
            if current_entry:
                entries.append("\n".join(current_entry))

            # 按时间倒序（最新在前）
            entries = entries[::-1]
            selected = entries[:limit]

            header = f"学习记录 (共 {len(entries)} 条，显示最近 {len(selected)} 条)\n{'='*50}\n"
            return header + "\n---\n".join(selected)
        except Exception as e:
            raise ValueError(f"读取学习记录失败: {e}")

    def add_learning(self, content: str, tool: str = "", error: str = "") -> str:
        """添加学习记录（追加到 learnings.md）"""
        if not content:
            raise ValueError("请提供学习内容")

        try:
            learnings_path = get_hermes_home() / "learnings.md"
        except Exception:
            learnings_path = os.path.expanduser("~/.hermes/learnings.md")

        try:
            os.makedirs(os.path.dirname(learnings_path), exist_ok=True)

            # 构建新条目
            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            entry_lines = [f"\n## [{now}] {tool}"]
            entry_lines.append(f"- **内容**: {content}")
            if tool:
                entry_lines.append(f"- **工具**: {tool}")
            if error:
                entry_lines.append(f"- **错误**: {error}")
            new_entry = "\n".join(entry_lines) + "\n"

            # 读取现有内容并检查条数
            existing = ""
            if os.path.isfile(learnings_path):
                with open(learnings_path, "r", encoding="utf-8", errors="replace") as f:
                    existing = f.read()

            # 计算现有条数
            entry_count = existing.count("\n## ")

            # 超过 50 条时删除最旧的条目
            if entry_count >= 50:
                # 找到第一个条目（最旧的）并删除
                first_entry_end = existing.find("\n## ", 1)
                if first_entry_end != -1:
                    existing = existing[first_entry_end:]
                else:
                    existing = ""

            # 写入
            with open(learnings_path, "w", encoding="utf-8") as f:
                f.write(existing + new_entry)

            return f"学习记录已添加 ({tool or '通用'})"
        except Exception as e:
            raise ValueError(f"添加学习记录失败: {e}")

    # ==================== 知识提取 ====================

    def generate_session_summary(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """基于消息内容生成会话摘要"""
        title = session.get("title", "未命名会话")
        model = session.get("model", "unknown")
        created = session.get("created_at", "")[:16]
        total_messages = len(messages)

        # Count by role
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        # Extract key topics from first few user messages
        topics = []
        for m in user_msgs[:5]:
            content = m.get("content", "")
            if len(content) > 10:
                topics.append(content[:100])

        lines = [
            f"## 会话摘要: {title}",
            "",
            f"- **模型**: {model}",
            f"- **时间**: {created}",
            f"- **消息数**: {total_messages} (用户 {len(user_msgs)} / 助手 {len(assistant_msgs)})",
            "",
        ]

        if topics:
            lines.append("### 主要讨论")
            for i, t in enumerate(topics, 1):
                lines.append(f"{i}. {t}")
            lines.append("")

        return "\n".join(lines)

    def extract_key_info(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """从消息中提取关键信息"""
        all_content = "\n".join(m.get("content", "") for m in messages)

        # Extract URLs
        urls = list(set(re.findall(r'https?://[^\s<>"\')\]]+', all_content)))

        # Extract file paths
        file_paths = list(set(re.findall(r'/[\w\-./]+\.\w+', all_content)))

        # Extract code blocks (language + count)
        code_blocks = re.findall(r'```(\w*)\n', all_content)
        code_count = len(code_blocks)
        code_languages = list(set(code_blocks))

        # Extract TODO/FIXME
        todos = re.findall(r'(?:TODO|FIXME|BUG|HACK)[\s:]*[^\n]{0,100}', all_content, re.IGNORECASE)

        # Extract numbers with units (metrics)
        metrics = re.findall(r'\d+(?:\.\d+)?\s*(?:ms|MB|KB|GB|秒|次|行|个|%|px)', all_content)

        return {
            "urls": urls[:20],
            "file_paths": file_paths[:20],
            "code_blocks": {"count": code_count, "languages": code_languages},
            "todos": todos[:10],
            "metrics": metrics[:10],
            "total_content_length": len(all_content),
        }

    def generate_skill_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """从会话消息中生成技能内容"""
        title = session.get("title", "自动提取技能")
        lines = [
            f"# {title}",
            "",
            f"> 自动从会话中提取",
            f"> 模型: {session.get('model', 'unknown')}",
            f"> 时间: {session.get('created_at', '')[:16]}",
            "",
            "## 使用方法",
            "",
        ]

        # Extract user requests as steps
        user_msgs = [m for m in messages if m.get("role") == "user"]
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        if user_msgs:
            lines.append("### 操作步骤")
            for i, m in enumerate(user_msgs[:10], 1):
                content = m.get("content", "").strip()
                if content:
                    lines.append(f"{i}. {content}")
            lines.append("")

        if assistant_msgs:
            lines.append("### 关键回复")
            for m in assistant_msgs[:5]:
                content = m.get("content", "").strip()
                if content:
                    lines.append(f"- {content[:200]}")
            lines.append("")

        return "\n".join(lines)

    def generate_knowledge_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """从会话中提取关键知识"""
        title = session.get("title", "未命名会话")
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        if not assistant_msgs:
            return ""

        lines = [
            f"### 来自: {title}",
            f"**时间**: {session.get('created_at', '')[:16]}",
            "",
        ]

        # Take key assistant responses
        for m in assistant_msgs[:3]:
            content = m.get("content", "").strip()
            if len(content) > 20:
                lines.append(f"- {content[:300]}")

        return "\n".join(lines)

    def generate_learning_from_messages(self, session: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
        """从会话中提取经验教训"""
        title = session.get("title", "未命名会话")
        all_content = "\n".join(m.get("content", "") for m in messages)

        # Look for error patterns, solutions, best practices
        patterns = [
            (r'(?:错误|失败|问题|bug)[：:\s]*([^\n]{10,200})', "问题"),
            (r'(?:解决|修复|方法|方案)[：:\s]*([^\n]{10,200})', "解决方案"),
            (r'(?:注意|避免|不要|切记)[：:\s]*([^\n]{10,200})', "注意事项"),
        ]

        learnings = []
        for pattern, category in patterns:
            matches = re.findall(pattern, all_content, re.IGNORECASE)
            for match in matches[:3]:
                learnings.append(f"- [{category}] {match.strip()}")

        if not learnings:
            # Fallback: just note the session happened
            learnings.append(f"- [{title}] 会话记录，{len(messages)} 条消息")

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

        lines = [
            f"## {title}",
            f"*{timestamp}*",
            "",
            "\n".join(learnings),
        ]

        return "\n".join(lines)


# 全局单例
memory_service = MemoryService()
