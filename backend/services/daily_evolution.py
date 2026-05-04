# -*- coding: utf-8 -*-
"""Daily Evolution - Scheduled daily evolution tasks"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class DailyEvolution:
    """Runs daily evolution tasks: cleanup, update, skill creation"""

    def run_daily(self) -> dict:
        """Execute all daily evolution tasks"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "cleanup": None,
            "knowledge_update": None,
            "skill_pattern": None,
        }

        # Step 1: Auto-cleanup knowledge
        try:
            from backend.mcp.tools.knowledge.auto_cleanup_knowledge import handle as cleanup_handle
            results["cleanup"] = cleanup_handle({"action": "full_cleanup"})
            logger.info(f"Knowledge cleanup completed")
        except Exception as e:
            results["cleanup"] = {"success": False, "message": str(e)}
            logger.warning(f"Knowledge cleanup failed: {e}")

        # Step 2: Knowledge auto-update
        try:
            from backend.mcp.tools.knowledge.knowledge_auto_update import handle as update_handle
            results["knowledge_update"] = update_handle({"limit": 100})
            logger.info(f"Knowledge auto-update completed")
        except Exception as e:
            results["knowledge_update"] = {"success": False, "message": str(e)}
            logger.warning(f"Knowledge auto-update failed: {e}")

        # Step 3: Auto-create skills from patterns
        try:
            from backend.mcp.tools.skill.auto_create_skill_from_pattern import handle as skill_handle
            results["skill_pattern"] = skill_handle({
                "min_occurrences": 3,
                "lookback_sessions": 20,
                "auto_approve": False,
            })
            logger.info(f"Skill pattern creation completed")
        except Exception as e:
            results["skill_pattern"] = {"success": False, "message": str(e)}
            logger.warning(f"Skill pattern creation failed: {e}")

        return results


# Global singleton
daily_evolution = DailyEvolution()
