# -*- coding: utf-8 -*-
"""Review Scheduler - Bridges review_policy.json to cron scheduler"""

import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

class ReviewScheduler:
    """Auto-create/update cron job from review_policy.json"""

    CRON_JOB_NAME = "auto_review"
    DEFAULT_SCHEDULE = "*/30 * * * *"
    DEFAULT_COMMAND = "curl -s -X POST http://localhost:7860/api/reviews/auto-review"

    def __init__(self):
        self._hermes_home = None

    def _get_hermes_home(self) -> Path:
        if self._hermes_home is None:
            from backend.config import get_hermes_home
            self._hermes_home = Path(get_hermes_home())
        return self._hermes_home

    def _get_policy_path(self) -> Path:
        return self._get_hermes_home() / "data" / "review_policy.json"

    def _get_policy(self) -> dict:
        """Read review policy, create default if not exists"""
        policy_path = self._get_policy_path()
        if policy_path.exists():
            try:
                with open(policy_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass

        # Create default policy
        default = {
            "default_strategy": "balanced",
            "auto_approve_threshold": 0.8,
            "auto_reject_threshold": 0.3,
            "auto_approve_categories": ["memory", "experience"],
            "require_manual_categories": ["rule"],
            "schedule_cron": self.DEFAULT_SCHEDULE,
            "risk_patterns": ["password", "api_key", "secret", "token", "credential"],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        policy_path.parent.mkdir(parents=True, exist_ok=True)
        with open(policy_path, 'w', encoding='utf-8') as f:
            json.dump(default, f, indent=2, ensure_ascii=False)
        logger.info(f"Created default review policy at {policy_path}")
        return default

    def init(self):
        """Called on app startup - sync cron job with policy"""
        try:
            policy = self._get_policy()
            schedule = policy.get("schedule_cron", self.DEFAULT_SCHEDULE)
            self._sync_cron_job(schedule)
            logger.info(f"Review scheduler initialized with schedule: {schedule}")
        except Exception as e:
            logger.warning(f"Review scheduler init failed: {e}")

    def _sync_cron_job(self, schedule: str):
        """Create or update the auto_review cron job"""
        from backend.services.cron_service import cron_service

        # Find existing job
        existing = None
        for job in cron_service.list_cron_jobs():
            if job.get("name") == self.CRON_JOB_NAME:
                existing = job
                break

        if existing:
            # Update if schedule changed
            if existing.get("schedule") != schedule:
                cron_service.update_cron_job(existing["id"], {
                    "schedule": schedule,
                    "command": self.DEFAULT_COMMAND,
                    "updated_at": datetime.now().isoformat(),
                })
                logger.info(f"Updated auto_review cron job schedule: {schedule}")
        else:
            # Create new
            cron_service.create_cron_job({
                "name": self.CRON_JOB_NAME,
                "schedule": schedule,
                "command": self.DEFAULT_COMMAND,
                "enabled": True,
            })
            logger.info(f"Created auto_review cron job with schedule: {schedule}")


# Global singleton
review_scheduler = ReviewScheduler()
