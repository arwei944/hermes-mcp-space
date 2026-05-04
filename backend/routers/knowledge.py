# -*- coding: utf-8 -*-
"""知识库 API — 聚合会话、经验、记忆、技能"""

from fastapi import APIRouter, Query
from backend.services.hermes_service import hermes_service
from backend.services import eval_service
from backend.routers.logs import _load_logs
from pathlib import Path
import os

router = APIRouter(prefix="/api", tags=["knowledge"])

HERMES_HOME = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))


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


# ---- Obsidian 集成 API ----

@router.get("/obsidian/config", summary="获取 Obsidian 配置")
async def get_obsidian_config():
    """获取 Obsidian Vault 配置"""
    config_file = HERMES_HOME / "data" / "obsidian_config.json"
    if config_file.exists():
        import json
        return json.loads(config_file.read_text(encoding="utf-8"))
    return {"vault_path": "", "auto_sync": False, "last_sync": None}


@router.put("/obsidian/config", summary="设置 Obsidian Vault 路径")
async def set_obsidian_config(body: dict):
    """设置 Obsidian Vault 路径"""
    import json
    config_file = HERMES_HOME / "data" / "obsidian_config.json"
    config_file.parent.mkdir(parents=True, exist_ok=True)
    config = {
        "vault_path": body.get("vault_path", ""),
        "auto_sync": body.get("auto_sync", False),
        "last_sync": None,
    }
    config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"success": True, "message": "配置已保存"}


@router.post("/obsidian/sync", summary="执行 Obsidian 双向同步")
async def sync_obsidian(direction: str = "both"):
    """执行 Obsidian Vault 与知识库的双向同步
    
    direction: "export"(仅导出), "import"(仅导入), "both"(双向,默认)
    双向同步策略：以最后修改时间较新的文件为准
    """
    import json
    from datetime import datetime
    config_file = HERMES_HOME / "data" / "obsidian_config.json"
    if not config_file.exists():
        return {"success": False, "message": "未配置 Obsidian Vault 路径"}

    config = json.loads(config_file.read_text(encoding="utf-8"))
    vault_path = config.get("vault_path", "")
    if not vault_path:
        return {"success": False, "message": "Vault 路径为空"}

    from pathlib import Path as P
    vault = P(vault_path)
    if not vault.exists():
        return {"success": False, "message": f"Vault 路径不存在: {vault_path}"}

    synced_files = []
    hermes_dir = HERMES_HOME / "memories"
    vault_hermes = vault / "Hermes"

    # 定义同步文件映射
    file_mappings = [
        ("MEMORY.md", hermes_dir / "MEMORY.md", vault_hermes / "MEMORY.md"),
        ("USER.md", hermes_dir / "USER.md", vault_hermes / "USER.md"),
        ("learnings.md", HERMES_HOME / "learnings.md", vault_hermes / "learnings.md"),
        ("SOUL.md", HERMES_HOME / "SOUL.md", vault_hermes / "SOUL.md"),
    ]

    for label, hermes_file, vault_file in file_mappings:
        hermes_exists = hermes_file.exists()
        vault_exists = vault_file.exists()

        # --- 导出：Hermes → Obsidian ---
        if direction in ("export", "both") and hermes_exists:
            if not vault_exists or hermes_file.stat().st_mtime >= vault_file.stat().st_mtime:
                vault_file.parent.mkdir(parents=True, exist_ok=True)
                vault_file.write_text(hermes_file.read_text(encoding="utf-8"), encoding="utf-8")
                synced_files.append(f"→ {label} (导出)")

        # --- 导入：Obsidian → Hermes ---
        if direction in ("import", "both") and vault_exists:
            if not hermes_exists or vault_file.stat().st_mtime > hermes_file.stat().st_mtime:
                hermes_file.parent.mkdir(parents=True, exist_ok=True)
                hermes_file.write_text(vault_file.read_text(encoding="utf-8"), encoding="utf-8")
                synced_files.append(f"← {label} (导入)")

    # 同步技能文件
    if direction in ("export", "both"):
        skills_dir = HERMES_HOME / "skills"
        vault_skills = vault_hermes / "skills"
        if skills_dir.exists():
            for sf in skills_dir.glob("*.json"):
                target = vault_skills / sf.name
                if not target.exists() or sf.stat().st_mtime >= target.stat().st_mtime:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(sf.read_text(encoding="utf-8"), encoding="utf-8")
                    synced_files.append(f"→ skills/{sf.name} (导出)")

    if direction in ("import", "both"):
        vault_skills = vault_hermes / "skills"
        skills_dir = HERMES_HOME / "skills"
        if vault_skills.exists():
            for sf in vault_skills.glob("*.json"):
                target = skills_dir / sf.name
                if not target.exists() or sf.stat().st_mtime > target.stat().st_mtime:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(sf.read_text(encoding="utf-8"), encoding="utf-8")
                    synced_files.append(f"← skills/{sf.name} (导入)")

    # 更新同步时间
    config["last_sync"] = datetime.now().isoformat()
    config_file.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "success": True,
        "message": f"已同步 {len(synced_files)} 个文件",
        "files": synced_files,
        "direction": direction,
    }


@router.get("/obsidian/status", summary="获取同步状态")
async def get_obsidian_status():
    """获取 Obsidian 同步状态"""
    import json
    config_file = HERMES_HOME / "data" / "obsidian_config.json"
    if not config_file.exists():
        return {"configured": False, "last_sync": None, "vault_path": ""}
    config = json.loads(config_file.read_text(encoding="utf-8"))
    return {
        "configured": bool(config.get("vault_path")),
        "vault_path": config.get("vault_path", ""),
        "auto_sync": config.get("auto_sync", False),
        "last_sync": config.get("last_sync"),
    }


@router.get("/search", summary="全文搜索知识库")
async def search_knowledge(q: str = "", type: str = "all"):
    """全文搜索知识库内容"""
    if not q:
        return {"results": [], "total": 0}

    results = []
    from pathlib import Path as P

    # 搜索记忆文件
    if type in ("all", "memory"):
        memory_file = HERMES_HOME / "data" / "MEMORY.md"
        if memory_file.exists():
            content = memory_file.read_text(encoding="utf-8")
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if q.lower() in line.lower():
                    results.append({
                        "type": "memory",
                        "file": "MEMORY.md",
                        "line": i + 1,
                        "content": line.strip(),
                        "context": lines[max(0, i-1):i+2],
                    })

    # 搜索用户文件
    if type in ("all", "user"):
        user_file = HERMES_HOME / "data" / "USER.md"
        if user_file.exists():
            content = user_file.read_text(encoding="utf-8")
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if q.lower() in line.lower():
                    results.append({
                        "type": "user",
                        "file": "USER.md",
                        "line": i + 1,
                        "content": line.strip(),
                        "context": lines[max(0, i-1):i+2],
                    })

    # 搜索学习记录
    if type in ("all", "experiences"):
        learnings_file = HERMES_HOME / "data" / "learnings.md"
        if learnings_file.exists():
            content = learnings_file.read_text(encoding="utf-8")
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if q.lower() in line.lower():
                    results.append({
                        "type": "experience",
                        "file": "learnings.md",
                        "line": i + 1,
                        "content": line.strip(),
                        "context": lines[max(0, i-1):i+2],
                    })

    return {"results": results[:50], "total": len(results)}

@router.post("/knowledge/auto-chain", summary="触发进化链")
async def trigger_auto_chain():
    """手动触发进化链：审核通过后自动执行 resolve -> rule 转换"""
    from backend.services.evolution_chain import evolution_chain
    result = evolution_chain.run_chain()
    return result


@router.post("/knowledge/auto-extract", summary="触发知识提取")
async def trigger_auto_extract():
    """手动触发从最近会话中自动提取知识"""
    from backend.services.extract_scheduler import extract_scheduler
    result = extract_scheduler.run_extract()
    return result
