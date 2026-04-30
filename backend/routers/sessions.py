# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 会话管理 API

提供会话的增删改查接口。
"""

import json
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query
from starlette.responses import StreamingResponse

from backend.services.hermes_service import hermes_service

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", summary="列出所有会话")
async def list_sessions() -> List[Dict[str, Any]]:
    """获取所有会话列表，按更新时间倒序排列"""
    return hermes_service.list_sessions()


@router.get("/stats", summary="获取会话统计")
async def get_session_stats() -> Dict[str, Any]:
    """获取会话统计数据：总会话数、活跃数、总消息数、今日新增数"""
    sessions = hermes_service.list_sessions()
    total = len(sessions)
    active = len([s for s in sessions if s.get("status") == "active"])

    # 统计总消息数
    try:
        messages_data = hermes_service._load_messages()
        if isinstance(messages_data, dict):
            total_messages = sum(len(msgs) for msgs in messages_data.values())
        else:
            total_messages = 0
    except Exception:
        total_messages = 0

    # 今日新增
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    today_count = len([s for s in sessions if str(s.get("created_at", "")).startswith(today)])

    return {"total": total, "active": active, "messages": total_messages, "today": today_count}


# --- Session Search ---

@router.get("/search", summary="全文搜索会话消息")
async def search_sessions(
    q: str = Query("", description="搜索关键词"),
    tags: str = Query("", description="标签过滤（逗号分隔）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
) -> Dict[str, Any]:
    """搜索会话和消息内容，支持标签过滤和分页"""
    results = []

    # 搜索会话标题
    if q:
        session_matches = hermes_service.search_sessions(q, limit=page_size * page)
        for s in session_matches:
            results.append({
                "type": "session",
                "session_id": s.get("id", ""),
                "title": s.get("title", ""),
                "model": s.get("model", ""),
                "created_at": s.get("created_at", ""),
                "updated_at": s.get("updated_at", ""),
                "tags": s.get("tags", []),
            })

    # 搜索消息内容
    if q:
        message_matches = hermes_service.search_messages(q, limit=page_size * page)
        for m in message_matches:
            results.append({
                "type": "message",
                "session_id": m.get("session_id", ""),
                "role": m.get("role", ""),
                "content": m.get("content", ""),
                "timestamp": m.get("timestamp", ""),
                "relevance": m.get("relevance", 0),
            })

    # 按标签过滤
    if tags:
        filter_tags = [t.strip() for t in tags.split(",") if t.strip()]
        if filter_tags:
            # 获取所有会话的标签信息
            all_sessions = hermes_service.list_sessions()
            session_tag_map = {}
            for s in all_sessions:
                session_tag_map[s.get("id", "")] = set(s.get("tags", []))
            # 过滤结果：只保留会话标签匹配的条目
            filtered = []
            for r in results:
                sid = r.get("session_id", "")
                s_tags = session_tag_map.get(sid, set())
                if any(ft in s_tags for ft in filter_tags):
                    filtered.append(r)
            results = filtered

    total = len(results)

    # 分页
    start = (page - 1) * page_size
    end = start + page_size
    paginated = results[start:end]

    return {"results": paginated, "total": total, "page": page, "page_size": page_size}


# --- Session Tags ---

@router.get("/tags", summary="获取所有标签")
async def list_tags() -> Dict[str, Any]:
    """获取所有标签及其使用统计"""
    tags = hermes_service.get_all_tags()
    return {"tags": tags}


@router.put("/{session_id}/tags", summary="设置会话标签")
async def set_session_tags(session_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """设置会话标签（替换模式）"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    tags = body.get("tags", [])
    if not isinstance(tags, list):
        raise HTTPException(status_code=400, detail="tags 必须是数组")
    result = hermes_service.update_session_field(session_id, tags=tags)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.put("/{session_id}/title", summary="重命名会话")
async def rename_session(session_id: str, body: Dict[str, str]) -> Dict[str, Any]:
    """重命名会话标题"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    title = body.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    result = hermes_service.update_session_field(session_id, title=title)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.put("/{session_id}/pin", summary="置顶/取消置顶")
async def toggle_pin(session_id: str, body: Dict[str, bool] = None) -> Dict[str, Any]:
    """切换会话置顶状态"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    body = body or {}
    pinned = body.get("pinned", not session.get("pinned", False))
    result = hermes_service.update_session_field(session_id, pinned=pinned)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.put("/{session_id}/archive", summary="归档/取消归档")
async def toggle_archive(session_id: str, body: Dict[str, bool] = None) -> Dict[str, Any]:
    """切换会话归档状态"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    body = body or {}
    archived = body.get("archived", not session.get("archived", False))
    result = hermes_service.update_session_field(session_id, archived=archived)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "更新失败"))
    return result


@router.get("/export", summary="导出所有会话")
async def export_all_sessions(
    format: str = Query("json", description="导出格式：json"),
) -> StreamingResponse:
    """导出所有会话数据"""
    if format == "json":
        sessions = hermes_service.list_sessions()
        data = hermes_service._load_sessions_data()
        content = json.dumps(data, ensure_ascii=False, indent=2)
        return StreamingResponse(
            iter([content]),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=sessions_export.json"},
        )
    else:
        raise HTTPException(status_code=400, detail=f"不支持的导出格式: {format}，当前仅支持 json")


# --- Batch Operations ---

@router.post("/batch/delete", summary="批量删除会话")
async def batch_delete_sessions(body: Dict[str, Any]) -> Dict[str, Any]:
    """批量删除多个会话"""
    session_ids = body.get("session_ids", [])
    if not session_ids:
        raise HTTPException(status_code=400, detail="session_ids 不能为空")
    results = []
    for sid in session_ids:
        result = hermes_service.delete_session(sid)
        results.append({"session_id": sid, **result})
    success_count = sum(1 for r in results if r.get("success"))
    return {"success": True, "total": len(session_ids), "deleted": success_count, "results": results}

@router.post("/batch/archive", summary="批量归档会话")
async def batch_archive_sessions(body: Dict[str, Any]) -> Dict[str, Any]:
    """批量归档/取消归档会话"""
    session_ids = body.get("session_ids", [])
    archived = body.get("archived", True)
    if not session_ids:
        raise HTTPException(status_code=400, detail="session_ids 不能为空")
    results = []
    for sid in session_ids:
        result = hermes_service.update_session_field(sid, archived=archived)
        results.append({"session_id": sid, **result})
    success_count = sum(1 for r in results if r.get("success"))
    return {"success": True, "total": len(session_ids), "updated": success_count, "results": results}

@router.post("/batch/tags", summary="批量设置标签")
async def batch_set_tags(body: Dict[str, Any]) -> Dict[str, Any]:
    """批量设置会话标签"""
    session_ids = body.get("session_ids", [])
    tags = body.get("tags", [])
    if not session_ids:
        raise HTTPException(status_code=400, detail="session_ids 不能为空")
    results = []
    for sid in session_ids:
        result = hermes_service.update_session_field(sid, tags=tags)
        results.append({"session_id": sid, **result})
    success_count = sum(1 for r in results if r.get("success"))
    return {"success": True, "total": len(session_ids), "updated": success_count, "results": results}

@router.post("/batch/export", summary="批量导出会话")
async def batch_export_sessions(body: Dict[str, Any]) -> StreamingResponse:
    """批量导出多个会话为 Markdown"""
    session_ids = body.get("session_ids", [])
    format = body.get("format", "markdown")
    if not session_ids:
        raise HTTPException(status_code=400, detail="session_ids 不能为空")

    if format == "markdown":
        parts = []
        for sid in session_ids:
            content = hermes_service.export_session_markdown(sid)
            if content:
                parts.append(content)
        combined = "\n\n---\n\n".join(parts)
        return StreamingResponse(
            iter([combined]),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=sessions_batch_export.md"},
        )
    elif format == "json":
        export_data = []
        for sid in session_ids:
            session = hermes_service.get_session(sid)
            if session:
                messages = hermes_service.get_session_messages(sid)
                export_data.append({"session": session, "messages": messages})
        content = json.dumps(export_data, ensure_ascii=False, indent=2)
        return StreamingResponse(
            iter([content]),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=sessions_batch_export.json"},
        )
    else:
        raise HTTPException(status_code=400, detail="不支持的格式，支持 markdown/json")


@router.post("", summary="创建会话")
async def create_session(body: Dict[str, str] = None) -> Dict[str, Any]:
    """创建新会话"""
    body = body or {}
    return hermes_service.create_session(
        title=body.get("title", ""),
        model=body.get("model", ""),
        source=body.get("source", "api"),
    )


# --- Analytics ---

@router.get("/analytics/overview", summary="会话分析概览")
async def analytics_overview() -> Dict[str, Any]:
    """会话分析概览统计数据"""
    return hermes_service.get_analytics_overview()

@router.get("/analytics/trends", summary="会话趋势数据")
async def analytics_trends(
    period: str = Query("daily", description="时间粒度: daily/weekly/monthly"),
    days: int = Query(30, ge=1, le=365, description="统计天数"),
) -> Dict[str, Any]:
    """获取会话趋势数据"""
    return hermes_service.get_analytics_trends(period, days)

@router.get("/analytics/distribution", summary="会话分布数据")
async def analytics_distribution() -> Dict[str, Any]:
    """获取会话分布数据（模型/标签/来源/时段）"""
    return hermes_service.get_analytics_distribution()

@router.get("/analytics/tools", summary="工具调用统计")
async def analytics_tools(
    days: int = Query(7, ge=1, le=90, description="统计天数"),
) -> Dict[str, Any]:
    """获取工具调用统计数据"""
    return hermes_service.get_analytics_tools(days)

@router.get("/analytics/behavior", summary="Agent 行为画像")
async def analytics_behavior() -> Dict[str, Any]:
    """获取 Agent 行为画像数据"""
    return hermes_service.get_analytics_behavior()


@router.get("/{session_id}", summary="获取会话详情")
async def get_session(session_id: str) -> Dict[str, Any]:
    """根据 ID 获取会话详情"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    return session


@router.get("/{session_id}/messages", summary="获取会话消息")
async def get_session_messages(session_id: str) -> List[Dict[str, Any]]:
    """获取指定会话的所有消息，按时间正序排列"""
    # 先验证会话是否存在
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    return hermes_service.get_session_messages(session_id)


@router.post("/{session_id}/messages", summary="添加消息到会话")
async def add_session_message(session_id: str, body: Dict[str, str]) -> Dict[str, Any]:
    """向指定会话添加一条消息"""
    role = body.get("role", "user")
    content = body.get("content", "")
    return hermes_service.add_session_message(session_id, role, content)


@router.delete("/{session_id}", summary="删除会话")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """删除指定会话及其所有消息"""
    result = hermes_service.delete_session(session_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", f"会话 {session_id} 不存在或删除失败"))
    return result


@router.post("/{session_id}/compress", summary="压缩会话上下文")
async def compress_session(session_id: str) -> Dict[str, Any]:
    """压缩指定会话的上下文，减少 token 消耗"""
    result = hermes_service.compress_session(session_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "压缩失败"))
    return result


# --- Session Export ---

@router.get("/{session_id}/export", summary="导出会话")
async def export_session(
    session_id: str,
    format: str = Query("markdown", description="导出格式：markdown/json/csv"),
) -> StreamingResponse:
    """导出单个会话为指定格式（markdown/json/csv）"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")

    if format == "markdown":
        content = hermes_service.export_session_markdown(session_id)
        return StreamingResponse(
            iter([content]),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={session_id}.md"},
        )
    elif format == "csv":
        content = hermes_service.export_session_csv(session_id)
        return StreamingResponse(
            iter([content]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={session_id}.csv"},
        )
    elif format == "json":
        messages = hermes_service.get_session_messages(session_id)
        export_data = {"session": session, "messages": messages}
        content = json.dumps(export_data, ensure_ascii=False, indent=2)
        return StreamingResponse(
            iter([content]),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={session_id}.json"},
        )
    else:
        raise HTTPException(status_code=400, detail=f"不支持的导出格式: {format}，支持 markdown/json/csv")


# --- Session Timeline ---

@router.get("/{session_id}/timeline", summary="获取会话时间线")
async def get_session_timeline(session_id: str) -> Dict[str, Any]:
    """获取会话的混合时间线（消息+事件）"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")

    messages = hermes_service.get_session_messages(session_id)
    timeline = []

    for m in messages:
        timeline.append({
            "type": "message",
            "data": {
                "role": m.get("role", ""),
                "content": m.get("content", ""),
            },
            "timestamp": m.get("timestamp", m.get("created_at", "")),
        })

    # 按时间排序
    timeline.sort(key=lambda x: x.get("timestamp", ""))

    return {"session_id": session_id, "timeline": timeline, "total": len(timeline)}


# --- Knowledge Extraction ---

@router.post("/{session_id}/summarize", summary="生成会话摘要")
async def summarize_session(session_id: str) -> Dict[str, Any]:
    """自动生成会话摘要（基于消息内容提取关键信息）"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    messages = hermes_service.get_session_messages(session_id)
    if not messages:
        raise HTTPException(status_code=400, detail="会话没有消息，无法生成摘要")

    summary = hermes_service.generate_session_summary(session, messages)
    result = hermes_service.update_session_field(session_id, summary=summary)
    return {"success": True, "session_id": session_id, "summary": summary}

@router.get("/{session_id}/extract", summary="提取会话关键信息")
async def extract_session_info(session_id: str) -> Dict[str, Any]:
    """从会话中提取关键信息（代码片段、URL、文件路径、TODO等）"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    messages = hermes_service.get_session_messages(session_id)

    extracted = hermes_service.extract_key_info(messages)
    return {"success": True, "session_id": session_id, "extracted": extracted}

@router.post("/{session_id}/to-skill", summary="将对话转为技能")
async def convert_to_skill(session_id: str, body: Dict[str, str] = None) -> Dict[str, Any]:
    """将会话中的关键操作提取为技能"""
    body = body or {}
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    messages = hermes_service.get_session_messages(session_id)

    skill_name = body.get("name", f"skill_from_{session_id[:12]}")
    description = body.get("description", f"从会话 '{session.get('title', '')}' 自动提取的技能")

    # Generate skill content from messages
    content = hermes_service.generate_skill_from_messages(session, messages)
    result = hermes_service.create_skill(skill_name, content=content, description=description)
    return result

@router.post("/{session_id}/to-memory", summary="将对话转为记忆")
async def convert_to_memory(session_id: str) -> Dict[str, Any]:
    """将会话中的关键知识提取并追加到记忆"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    messages = hermes_service.get_session_messages(session_id)

    knowledge = hermes_service.generate_knowledge_from_messages(session, messages)
    if not knowledge:
        raise HTTPException(status_code=400, detail="未能从会话中提取有效知识")

    # Append to MEMORY.md
    current = hermes_service.read_memory()
    existing_memory = current.get("memory", "")
    new_memory = existing_memory.rstrip() + "\n\n" + knowledge if existing_memory else knowledge
    result = hermes_service.update_memory(memory=new_memory)
    return {"success": True, "session_id": session_id, "knowledge": knowledge, **result}

@router.post("/{session_id}/to-learning", summary="将对话转为学习记录")
async def convert_to_learning(session_id: str) -> Dict[str, Any]:
    """将会话中的经验教训提取为学习记录"""
    session = hermes_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")
    messages = hermes_service.get_session_messages(session_id)

    learning = hermes_service.generate_learning_from_messages(session, messages)
    if not learning:
        raise HTTPException(status_code=400, detail="未能从会话中提取有效学习记录")

    # Append to learnings.md
    from backend.config import get_hermes_home
    learnings_path = get_hermes_home() / "learnings.md"
    existing = learnings_path.read_text(encoding="utf-8") if learnings_path.exists() else ""
    new_content = existing.rstrip() + "\n\n" + learning if existing else learning
    learnings_path.write_text(new_content, encoding="utf-8")

    return {"success": True, "session_id": session_id, "learning": learning}
