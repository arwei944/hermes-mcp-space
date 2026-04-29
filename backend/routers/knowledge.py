# -*- coding: utf-8 -*-
"""知识库 API — 聚合会话、经验、记忆、技能"""

from fastapi import APIRouter, Query
from backend.services.hermes_service import hermes_service
from backend.services import eval_service
from backend.routers.logs import _load_logs
from pathlib import Path
import os

router = APIRouter(prefix="/api", tags=["knowledge"])


@router.get("/knowledge/overview")
async def knowledge_overview():
    """知识库概览：各类知识的数量统计"""
    sessions = hermes_service.list_sessions()
    skills = hermes_service.list_skills()
    memory = hermes_service.read_memory()

    # 读取文件类数据
    hermes_home = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))
    learnings_path = hermes_home / "learnings.md"
    soul_path = hermes_home / "SOUL.md"
    learnings_text = learnings_path.read_text(encoding="utf-8", errors="replace") if learnings_path.exists() else ""
    soul_text = soul_path.read_text(encoding="utf-8", errors="replace") if soul_path.exists() else ""

    # 统计消息总数
    total_messages = 0
    for s in sessions:
        msgs = hermes_service.get_session_messages(s.get("id") or s.get("session_id", ""))
        if isinstance(msgs, list):
            total_messages += len(msgs)
        elif isinstance(msgs, str) and msgs.strip():
            total_messages += len(msgs.strip().split("\n"))

    # 统计经验条目数
    learning_count = learnings_text.count("\n## ") if learnings_text.strip() else 0

    return {
        "sessions": len(sessions),
        "total_messages": total_messages,
        "skills": len(skills) if isinstance(skills, list) else 0,
        "memory_chars": len(str(memory)) if memory else 0,
        "learning_count": learning_count,
        "soul_chars": len(soul_text),
    }


@router.get("/knowledge/sessions")
async def knowledge_sessions(limit: int = Query(default=12, le=50)):
    """最近会话（带消息摘要）"""
    sessions = hermes_service.list_sessions()
    result = []
    for s in sessions[:limit]:
        sid = s.get("id") or s.get("session_id", "")
        msgs = hermes_service.get_session_messages(sid)
        msg_count = 0
        last_msg = ""
        if isinstance(msgs, list):
            msg_count = len(msgs)
            if msgs:
                last = msgs[-1]
                content = last.get("content", "")
                if isinstance(content, str):
                    last_msg = content[:100]
        elif isinstance(msgs, str) and msgs.strip():
            lines = msgs.strip().split("\n")
            msg_count = len(lines)
            last_msg = lines[-1][:100] if lines else ""

        result.append({
            "id": sid,
            "title": s.get("title", ""),
            "model": s.get("model", ""),
            "source": s.get("source", ""),
            "status": s.get("status", ""),
            "created_at": s.get("created_at", ""),
            "updated_at": s.get("updated_at", ""),
            "message_count": msg_count,
            "last_message": last_msg,
        })
    return result


@router.get("/knowledge/experiences")
async def knowledge_experiences(limit: int = Query(default=20, le=50)):
    """经验记录（从 learnings.md 提取）"""
    hermes_home = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))
    learnings_path = hermes_home / "learnings.md"
    if not learnings_path.exists():
        return []

    text = learnings_path.read_text(encoding="utf-8", errors="replace")
    # 按 ## 分割为条目
    entries = []
    current = None
    for line in text.split("\n"):
        if line.startswith("## "):
            if current:
                entries.append(current)
            current = {"title": line[3:].strip(), "content": "", "lines": []}
        elif current:
            current["content"] += line + "\n"
            current["lines"].append(line)

    if current:
        entries.append(current)

    return entries[:limit]


@router.get("/knowledge/memory")
async def knowledge_memory():
    """记忆内容"""
    memory = hermes_service.read_memory()
    return {
        "content": str(memory) if memory else "",
        "chars": len(str(memory)) if memory else 0,
    }


@router.get("/knowledge/skills")
async def knowledge_skills():
    """技能列表（带内容预览）"""
    skills = hermes_service.list_skills()
    if not isinstance(skills, list):
        return []

    result = []
    for s in skills:
        name = s.get("name", "")
        # 获取技能内容预览
        content = ""
        try:
            skill_data = hermes_service.get_skill_content(name)
            if isinstance(skill_data, dict):
                content = str(skill_data.get("content", ""))[:200]
            elif isinstance(skill_data, str):
                content = skill_data[:200]
        except Exception:
            pass

        result.append({
            "name": name,
            "description": s.get("description", ""),
            "tags": s.get("tags", []),
            "preview": content,
        })
    return result


@router.get("/knowledge/auto-learn")
async def trigger_auto_learn():
    """手动触发全量自动学习"""
    from backend.services.auto_learner import run_full_learning
    result = run_full_learning()
    return result


@router.get("/knowledge/analysis")
async def knowledge_analysis():
    """获取自动分析结果（不写入文件，只预览）"""
    from backend.services.auto_learner import analyze_errors, analyze_patterns, analyze_preferences, suggest_skills
    return {
        "errors": analyze_errors(),
        "patterns": analyze_patterns(),
        "preferences": analyze_preferences(),
        "skill_suggestions": suggest_skills(),
    }
