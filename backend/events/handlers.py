# -*- coding: utf-8 -*-
"""EventBus 事件处理器注册

在 app.py 启动时调用 register_event_handlers()，
将后端各模块注册为 EventBus 的事件订阅者。
"""

import logging

logger = logging.getLogger("hermes.events")


def register_event_handlers():
    from backend.events.bus import bus
    registered = 0

    def on_review_approved(data):
        try:
            from backend.services.evolution_chain import evolution_chain
            evolution_chain.run_chain()
            logger.info("EventBus: review.approved -> evolution_chain triggered")
        except Exception as e:
            logger.warning(f"EventBus handler error (review.approved): {e}")
    bus.on("review.approved", on_review_approved)
    registered += 1

    def on_tool_complete(data):
        try:
            tool_name = data.get("tool", "") if data else ""
            ok = data.get("ok", True) if data else True
            if tool_name:
                from backend.services.auto_learner import run_incremental_learning
                run_incremental_learning(tool_name, ok)
        except Exception as e:
            logger.debug(f"EventBus handler error (mcp.tool_complete): {e}")
    bus.on("mcp.tool_complete", on_tool_complete)
    registered += 1

    def on_session_completed(data):
        try:
            session_id = data.get("session_id", "") if data else ""
            if session_id:
                from backend.services.knowledge_extractor import KnowledgeExtractor
                extractor = KnowledgeExtractor()
                extracted = extractor.extract_from_session(session_id, auto_submit=True)
                if extracted:
                    total = len(extracted.get("knowledge", [])) + len(extracted.get("experiences", [])) + len(extracted.get("memories", []))
                    if total > 0:
                        logger.info(f"EventBus: session.completed -> extracted {total} items")
        except Exception as e:
            logger.debug(f"EventBus handler error (session.completed): {e}")
    bus.on("session.completed", on_session_completed)
    registered += 1

    def on_knowledge_change(data):
        try:
            from backend.services.search_service import SearchService
            svc = SearchService()
            svc.rebuild_index()
        except Exception as e:
            logger.debug(f"EventBus handler error (knowledge.*): {e}")
    bus.on("knowledge.created", on_knowledge_change)
    bus.on("knowledge.updated", on_knowledge_change)
    bus.on("knowledge.deleted", on_knowledge_change)
    registered += 3

    logger.info(f"EventBus: {registered} event handlers registered")
    return registered