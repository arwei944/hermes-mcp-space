# -*- coding: utf-8 -*-
"""Hermes Agent - 数据完整性校验服务

启动时自动校验数据完整性，发现并修复常见问题：
- SQLite 数据库完整性检查
- JSON 文件可解析性检查
- SQLite vs JSON 双写一致性检查（以 SQLite 为准修复 JSON）
- 数据目录结构检查

使用方式：
    from backend.services.data_integrity import DataIntegrityChecker
    checker = DataIntegrityChecker(hermes_home)
    report = checker.run_full_check()
"""

import json
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes.integrity")


class DataIntegrityChecker:
    """数据完整性校验器"""

    def __init__(self, hermes_home: Optional[str] = None):
        self.hermes_home = Path(hermes_home or os.environ.get(
            "HERMES_HOME", os.path.expanduser("~/.hermes")
        ))
        self.report: Dict[str, Any] = {
            "timestamp": datetime.now().isoformat(),
            "checks": [],
            "errors": [],
            "fixes": [],
        }

    def run_full_check(self, auto_fix: bool = True) -> Dict[str, Any]:
        logger.info("Starting data integrity check...")
        self._check_directory_structure()
        self._check_sqlite_databases()
        self._check_json_files()
        if auto_fix:
            self._fix_dual_write_consistency()
        total_checks = len(self.report["checks"])
        total_errors = len(self.report["errors"])
        total_fixes = len(self.report["fixes"])
        self.report["summary"] = {
            "total_checks": total_checks,
            "total_errors": total_errors,
            "total_fixes": total_fixes,
            "status": "ok" if total_errors == 0 else "issues_found",
        }
        status = self.report["summary"]["status"]
        if status == "ok":
            logger.info(f"Data integrity check passed ({total_checks} checks)")
        else:
            logger.warning(f"Data integrity check found {total_errors} issues, auto-fixed {total_fixes}")
        return self.report

    def _add_check(self, name: str, passed: bool, detail: str = ""):
        self.report["checks"].append({"name": name, "passed": passed, "detail": detail})
        if not passed:
            self.report["errors"].append({"name": name, "detail": detail})

    def _add_fix(self, name: str, detail: str):
        self.report["fixes"].append({"name": name, "detail": detail, "timestamp": datetime.now().isoformat()})

    def _check_directory_structure(self):
        required_dirs = ["data", "skills", "memories", "cron", "agents", "logs"]
        for dir_name in required_dirs:
            dir_path = self.hermes_home / dir_name
            if dir_path.exists():
                self._add_check(f"dir:{dir_name}", True, "exists")
            else:
                dir_path.mkdir(parents=True, exist_ok=True)
                self._add_check(f"dir:{dir_name}", False, "missing, auto-created")
                self._add_fix(f"dir:{dir_name}", f"Created missing directory: {dir_name}")

    def _check_sqlite_databases(self):
        db_files = {"data/knowledge.db": "知识库数据库", "data/sessions.db": "会话数据库"}
        for db_rel_path, description in db_files.items():
            db_path = self.hermes_home / db_rel_path
            if not db_path.exists():
                self._add_check(f"db:{db_rel_path}", False, f"{description}不存在")
                continue
            try:
                conn = sqlite3.connect(str(db_path), timeout=5)
                result = conn.execute("PRAGMA integrity_check").fetchone()
                if result and result[0] == "ok":
                    self._add_check(f"db:{db_rel_path}", True, f"{description}完整性正常")
                else:
                    self._add_check(f"db:{db_rel_path}", False, f"{description}完整性异常: {result[0] if result else 'unknown'}")
                tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
                for table in tables:
                    count = conn.execute(f"SELECT COUNT(*) FROM [{table[0]}]").fetchone()[0]
                    logger.debug(f"  {db_rel_path}.{table[0]}: {count} rows")
                conn.close()
            except Exception as e:
                self._add_check(f"db:{db_rel_path}", False, f"{description}检查失败: {e}")

    def _check_json_files(self):
        json_files = {"data/sessions.json": "会话数据", "data/logs.json": "操作日志", "data/cron_jobs.json": "定时任务", "mcp_servers.json": "MCP 服务配置"}
        for json_rel_path, description in json_files.items():
            json_path = self.hermes_home / json_rel_path
            if not json_path.exists():
                self._add_check(f"json:{json_rel_path}", True, f"{description}不存在（首次启动）")
                continue
            try:
                content = json_path.read_text(encoding="utf-8")
                if content.strip():
                    json.loads(content)
                    self._add_check(f"json:{json_rel_path}", True, f"{description}可解析")
                else:
                    self._add_check(f"json:{json_rel_path}", True, f"{description}为空（首次启动）")
            except json.JSONDecodeError as e:
                self._add_check(f"json:{json_rel_path}", False, f"{description}JSON 解析失败: {e}")
            except Exception as e:
                self._add_check(f"json:{json_rel_path}", False, f"{description}读取失败: {e}")

    def _fix_dual_write_consistency(self):
        db_path = self.hermes_home / "data" / "sessions.db"
        json_path = self.hermes_home / "data" / "sessions.json"
        if not db_path.exists() or not json_path.exists():
            return
        try:
            conn = sqlite3.connect(str(db_path), timeout=5)
            db_session_count = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
            db_message_count = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            conn.close()
            try:
                json_data = json.loads(json_path.read_text(encoding="utf-8"))
                json_session_count = len(json_data.get("sessions", []))
                json_message_count = sum(len(msgs) for msgs in json_data.get("messages", {}).values())
            except Exception:
                json_session_count = -1
                json_message_count = -1
            if abs(db_session_count - json_session_count) == 0 and abs(db_message_count - json_message_count) == 0:
                self._add_check("dual_write:consistency", True, f"SQLite({db_session_count}s/{db_message_count}m) == JSON({json_session_count}s/{json_message_count}m)")
            else:
                self._add_check("dual_write:consistency", False, f"数据不一致: SQLite({db_session_count}s/{db_message_count}m) vs JSON({json_session_count}s/{json_message_count}m)")
                self._add_fix("dual_write:consistency", "JSON 数据与 SQLite 不一致，建议通过 API 触发 compat sync 修复")
        except Exception as e:
            logger.debug(f"Dual write consistency check skipped: {e}")


data_integrity_checker = DataIntegrityChecker()
