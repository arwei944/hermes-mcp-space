# -*- coding: utf-8 -*-
"""Extract Scheduler - Auto-extract knowledge from recent sessions"""

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ExtractScheduler:
    """Auto-extract knowledge from recent active sessions"""

    def run_extract(self) -> dict:
        """Extract knowledge from recent sessions"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "sessions_scanned": 0,
            "items_extracted": 0,
            "details": [],
        }

        try:
            from backend.services.session_service import SessionService
            svc = SessionService()
            sessions = svc.list_sessions()

            # Process last 10 sessions
            recent = sessions[:10]
            results["sessions_scanned"] = len(recent)

            for session in recent:
                try:
                    from backend.services.knowledge_extractor import KnowledgeExtractor
                    extractor = KnowledgeExtractor()
                    extracted = extractor.extract_from_session(session["id"])
                    if extracted and extracted.get("items"):
                        results["items_extracted"] += len(extracted["items"])
                        results["details"].append({
                            "session_id": session["id"],
                            "items": len(extracted["items"]),
                        })
                except Exception as e:
                    logger.debug(f"Extract from session {session['id']} failed: {e}")
                    continue

            logger.info(f"Extract completed: {results['sessions_scanned']} sessions, {results['items_extracted']} items")
        except Exception as e:
            results["error"] = str(e)
            logger.warning(f"Extract scheduler failed: {e}")

        return results


# Global singleton
extract_scheduler = ExtractScheduler()
