"""
知识提取服务 — 从对话中自动提取知识、经验、记忆
"""

import json
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from backend.services.knowledge_service import KnowledgeService
from backend.services.review_service import ReviewService


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


class KnowledgeExtractor:
    """从对话中自动提取知识的服务"""

    def __init__(self):
        self.knowledge_svc = KnowledgeService()
        self.review_svc = ReviewService()

    def extract_from_session(self, session_id: str, auto_submit: bool = False) -> dict:
        """从对话中批量提取知识、经验、记忆"""
        from backend.services.hermes_service import hermes_service
        messages = hermes_service.get_session_messages(session_id)
        if not messages:
            return {"knowledge": [], "experiences": [], "memories": [], "review_ids": []}

        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]
        user_msgs = [m for m in messages if m.get("role") == "user"]

        results = {"knowledge": [], "experiences": [], "memories": [], "review_ids": []}

        # 1. Extract knowledge from assistant replies
        for msg in assistant_msgs:
            content = msg.get("content", "")
            knowledge_items = self._extract_knowledge(content, session_id)
            for item in knowledge_items:
                results["knowledge"].append(item)
                if auto_submit:
                    review = self._submit_knowledge_review(item, session_id)
                    results["review_ids"].append(review["id"])

        # 2. Extract experiences from tool errors
        experiences = self._extract_experiences_from_errors(messages, session_id)
        for item in experiences:
            results["experiences"].append(item)
            if auto_submit:
                review = self._submit_experience_review(item, session_id)
                results["review_ids"].append(review["id"])

        # 3. Extract memories from user preferences
        for msg in user_msgs:
            content = msg.get("content", "")
            memory_items = self._extract_memories(content, session_id)
            for item in memory_items:
                results["memories"].append(item)
                if auto_submit:
                    review = self._submit_memory_review(item, session_id)
                    results["review_ids"].append(review["id"])

        return results

    def _extract_knowledge(self, content: str, session_id: str) -> List[dict]:
        """Extract factual knowledge from assistant replies"""
        items = []
        sections = re.split(r'\n#{1,3}\s+', content)
        for section in sections:
            section = section.strip()
            if len(section) < 50:
                continue
            lines = section.split("\n")
            title = lines[0].strip()
            body = "\n".join(lines[1:]).strip()
            knowledge_indicators = [
                "步骤", "方法", "原理", "原因", "配置", "安装",
                "注意", "重要", "关键", "核心", "必须", "应该",
                "step", "method", "note", "important", "key", "must"
            ]
            if any(indicator in title.lower() or indicator in body.lower()[:200]):
                items.append({
                    "title": title[:100],
                    "content": body[:2000],
                    "category": self._classify_knowledge(title, body),
                    "tags": self._extract_tags(title, body),
                    "confidence": 0.6
                })
        return items

    def _extract_experiences_from_errors(self, messages: List[dict], session_id: str) -> List[dict]:
        """Extract experiences from tool call errors"""
        items = []
        for msg in messages:
            content = msg.get("content", "")
            if not content:
                continue
            error_patterns = [
                (r'Error[:\s]+(.+?)(?:\n|$)', "error_pattern"),
                (r'失败[:\s]+(.+?)(?:\n|$)', "error_pattern"),
                (r'Exception[:\s]+(.+?)(?:\n|$)', "error_pattern"),
                (r'WARNING[:\s]+(.+?)(?:\n|$)', "pitfall"),
                (r'注意[:\s]+(.+?)(?:\n|$)', "pitfall"),
            ]
            for pattern, category in error_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches:
                    error_text = match.strip()
                    if len(error_text) < 10:
                        continue
                    items.append({
                        "title": f"错误: {error_text[:80]}",
                        "content": f"## 错误描述\n\n{error_text}\n\n## 上下文\n\n{content[:500]}",
                        "category": category,
                        "severity": "high" if "critical" in error_text.lower() or "fatal" in error_text.lower() else "medium",
                        "source_ref": session_id,
                        "confidence": 0.7
                    })
        return items

    def _extract_memories(self, content: str, session_id: str) -> List[dict]:
        """Extract preferences/memories from user messages"""
        items = []
        preference_patterns = [
            r'(?:我喜欢|我偏好|我习惯|请记住|以后|总是|不要|千万别|务必)(.{10,100})',
            r'(?:prefer|always|never|remember|don\'t|please)\s+(.{10,100})',
        ]
        for pattern in preference_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                pref_text = match.strip()
                if len(pref_text) < 10:
                    continue
                items.append({
                    "title": f"用户偏好: {pref_text[:50]}",
                    "content": pref_text,
                    "category": "preference",
                    "importance": 6,
                    "source_ref": session_id,
                    "confidence": 0.5
                })
        return items

    def _classify_knowledge(self, title: str, content: str) -> str:
        text = (title + " " + content[:200]).lower()
        if any(w in text for w in ["代码", "函数", "api", "bug", "error", "配置", "部署"]):
            return "tech"
        if any(w in text for w in ["项目", "产品", "需求", "功能", "模块"]):
            return "project"
        if any(w in text for w in ["faq", "问题", "常见", "如何"]):
            return "faq"
        return "general"

    def _extract_tags(self, title: str, content: str) -> List[str]:
        tags = []
        words = re.findall(r'[\u4e00-\u9fff]{2,4}|[a-zA-Z]{2,}', title)
        tags.extend(words[:3])
        return list(set(tags))

    def _submit_knowledge_review(self, item: dict, session_id: str) -> dict:
        payload = json.dumps(item, ensure_ascii=False)
        return self.review_svc.submit_review(
            target_type="knowledge", action="create",
            title=item["title"], content=payload,
            reason=f"AI 自动从会话 {session_id[:12]} 中提取知识",
            confidence=item.get("confidence", 0.6), session_id=session_id
        )

    def _submit_experience_review(self, item: dict, session_id: str) -> dict:
        payload = json.dumps(item, ensure_ascii=False)
        return self.review_svc.submit_review(
            target_type="experience", action="create",
            title=item["title"], content=payload,
            reason=f"AI 自动从会话 {session_id[:12]} 中提取经验",
            confidence=item.get("confidence", 0.7), session_id=session_id
        )

    def _submit_memory_review(self, item: dict, session_id: str) -> dict:
        payload = json.dumps(item, ensure_ascii=False)
        return self.review_svc.submit_review(
            target_type="memory", action="create",
            title=item["title"], content=payload,
            reason=f"AI 自动从会话 {session_id[:12]} 中提取用户偏好",
            confidence=item.get("confidence", 0.5), session_id=session_id
        )
