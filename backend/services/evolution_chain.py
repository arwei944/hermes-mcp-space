# -*- coding: utf-8 -*-
"""Evolution Chain - Post-review chain trigger engine"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class EvolutionChain:
    """Chain-triggered evolution: review -> resolve -> rule -> skill"""

    def run_chain(self) -> dict:
        """Execute the full evolution chain"""
        results = {
            "timestamp": datetime.now().isoformat(),
            "auto_resolve": None,
            "experience_to_rule": None,
        }

        # Step 1: Auto-resolve covered experiences
        try:
            from backend.mcp.tools.knowledge.auto_resolve_experience import handle as resolve_handle
            results["auto_resolve"] = resolve_handle({
                "auto_resolve": True,
                "dry_run": False,
            })
            logger.info(f"Auto-resolve completed: {results['auto_resolve'].get('message', '')}")
        except Exception as e:
            results["auto_resolve"] = {"success": False, "message": str(e)}
            logger.warning(f"Auto-resolve failed: {e}")

        # Step 2: Convert high-frequency experiences to rules
        try:
            from backend.mcp.tools.knowledge.experience_to_rule import handle as rule_handle
            results["experience_to_rule"] = rule_handle({
                "min_occurrences": 3,
            })
            logger.info(f"Experience-to-rule completed: {results['experience_to_rule'].get('message', '')}")
        except Exception as e:
            results["experience_to_rule"] = {"success": False, "message": str(e)}
            logger.warning(f"Experience-to-rule failed: {e}")

        return results


# Global singleton
evolution_chain = EvolutionChain()
