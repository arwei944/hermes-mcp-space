# -*- coding: utf-8 -*-
"""配置自动审核策略 — 管理自动审核的策略配置，以 JSON 文件形式持久化"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from backend.mcp.tools._base import register_tool, success_response, error_response


# 默认策略配置
_DEFAULT_POLICY = {
    "default_strategy": "balanced",
    "auto_approve_threshold": 0.8,
    "auto_reject_threshold": 0.3,
    "auto_approve_categories": ["memory", "experience"],
    "require_manual_categories": ["rule"],
    "schedule_cron": "*/30 * * * *",
    "risk_patterns": ["password", "api_key", "secret", "token", "credential"],
}


def _get_policy_path() -> Path:
    """获取策略文件路径"""
    from backend.config import get_hermes_home
    policy_dir = get_hermes_home() / "data"
    policy_dir.mkdir(parents=True, exist_ok=True)
    return policy_dir / "review_policy.json"


def _load_policy(path: Path) -> dict:
    """加载策略文件，如果不存在则创建默认策略"""
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass

    # 文件不存在或损坏，创建默认策略
    policy = _create_default_policy()
    _save_policy(path, policy)
    return policy


def _create_default_policy() -> dict:
    """创建默认策略"""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    policy = dict(_DEFAULT_POLICY)
    policy["created_at"] = now
    policy["updated_at"] = now
    return policy


def _save_policy(path: Path, policy: dict) -> None:
    """保存策略到文件"""
    policy["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(policy, f, ensure_ascii=False, indent=2)


def register(reg):
    register_tool(
        reg,
        name="configure_review_policy",
        description="配置自动审核策略。支持获取当前策略、更新策略字段和重置为默认策略。策略以 JSON 文件形式持久化存储。",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["get", "set", "reset"],
                    "default": "get",
                    "description": "操作类型: get 获取当前策略 / set 更新策略 / reset 重置为默认",
                },
                "default_strategy": {
                    "type": "string",
                    "enum": ["conservative", "balanced", "aggressive"],
                    "description": "默认审核策略",
                },
                "auto_approve_threshold": {
                    "type": "number",
                    "description": "自动通过置信度阈值 (0-1)",
                },
                "auto_reject_threshold": {
                    "type": "number",
                    "description": "自动拒绝置信度阈值 (0-1)",
                },
                "auto_approve_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "可自动通过的类别列表",
                },
                "require_manual_categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "必须人工审核的类别列表",
                },
                "schedule_cron": {
                    "type": "string",
                    "description": "自动审核定时任务的 cron 表达式",
                },
            },
        },
        handler=handle,
        tags=["review"],
    )


def handle(args: dict) -> dict:
    try:
        action = args.get("action", "get")
        policy_path = _get_policy_path()

        if action == "get":
            policy = _load_policy(policy_path)
            return success_response(
                data=policy,
                message="当前审核策略已获取",
            )

        elif action == "set":
            policy = _load_policy(policy_path)
            changed_fields = []

            # 逐字段合并更新
            field_map = {
                "default_strategy": "default_strategy",
                "auto_approve_threshold": "auto_approve_threshold",
                "auto_reject_threshold": "auto_reject_threshold",
                "auto_approve_categories": "auto_approve_categories",
                "require_manual_categories": "require_manual_categories",
                "schedule_cron": "schedule_cron",
            }

            for arg_key, policy_key in field_map.items():
                if arg_key in args and args[arg_key] is not None:
                    value = args[arg_key]

                    # 数值类型校验
                    if policy_key in ("auto_approve_threshold", "auto_reject_threshold"):
                        value = float(value)
                        if not (0 <= value <= 1):
                            return error_response(f"{policy_key} 必须在 0 到 1 之间")

                    policy[policy_key] = value
                    changed_fields.append(policy_key)

            if not changed_fields:
                return success_response(
                    data=policy,
                    message="未提供需要更新的字段",
                )

            _save_policy(policy_path, policy)

            # After saving policy, sync cron schedule
            try:
                from backend.services.review_scheduler import review_scheduler
                schedule = policy.get("schedule_cron", "*/30 * * * *")
                review_scheduler._sync_cron_job(schedule)
            except Exception as e:
                pass  # Don't fail policy update if cron sync fails

            return success_response(
                data=policy,
                message=f"审核策略已更新，变更字段: {', '.join(changed_fields)}",
            )

        elif action == "reset":
            policy = _create_default_policy()
            _save_policy(policy_path, policy)
            return success_response(
                data=policy,
                message="审核策略已重置为默认值",
            )

        else:
            return error_response(f"无效的 action: {action}，必须是 get、set 或 reset")

    except Exception as e:
        return error_response(str(e))
