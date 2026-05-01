# -*- coding: utf-8 -*-
"""操作审计日志服务

记录和查询系统操作审计日志，支持按操作类型、资源类型过滤。
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AuditService:
    """操作审计日志服务

    将审计日志以 JSON Lines 格式写入文件，支持查询和统计。
    """

    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or os.path.join(os.path.expanduser("~"), ".hermes")
        self.log_file = os.path.join(self.data_dir, "audit.log")
        os.makedirs(self.data_dir, exist_ok=True)

    def log(
        self,
        action: str,
        resource_type: str = "",
        resource_id: str = "",
        details: Optional[Dict[str, Any]] = None,
        user: str = "system",
    ) -> None:
        """记录审计日志"""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user": user,
            "details": details or {},
        }

        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")

    def query(
        self,
        action: str = None,
        resource_type: str = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """查询审计日志"""
        if not os.path.exists(self.log_file):
            return []

        entries = []
        try:
            with open(self.log_file, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        entry = json.loads(line.strip())
                        if action and entry.get("action") != action:
                            continue
                        if resource_type and entry.get("resource_type") != resource_type:
                            continue
                        entries.append(entry)
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Failed to read audit log: {e}")

        # 按时间倒序
        entries.reverse()
        return entries[offset : offset + limit]

    def get_stats(self) -> Dict[str, Any]:
        """获取审计统计"""
        entries = self.query(limit=10000)
        stats = {}
        for entry in entries:
            action = entry.get("action", "unknown")
            stats[action] = stats.get(action, 0) + 1
        return {"total": len(entries), "by_action": stats}


# 全局服务实例
audit_service = AuditService()
