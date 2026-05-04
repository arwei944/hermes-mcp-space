# -*- coding: utf-8 -*-
"""Hermes Agent - 工具调用追踪与 Evals 服务"""

import json, logging, os, threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes-mcp")
_MAX_LINES = 10000
_TRIM_TO = 5000
_lock = threading.Lock()

def _get_trace_file() -> Path:
    hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    log_dir = Path(hermes_home) / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "tool_traces.jsonl"

def _auto_trim(filepath: Path) -> None:
    try:
        with open(filepath, "r", encoding="utf-8") as f: lines = f.readlines()
    except Exception: return
    if len(lines) <= _MAX_LINES: return
    with open(filepath, "w", encoding="utf-8") as f: f.writelines(lines[-_TRIM_TO:])
    logger.info(f"tool_traces.jsonl auto-trimmed: {len(lines)} -> {_TRIM_TO}")

def record_tool_call(tool_name: str, arguments: Dict[str, Any], success: bool, latency_ms: int, error: str, source: str = "mcp", agent_id: str = "", session_id: str = "") -> None:
    record = {"ts": datetime.now(timezone.utc).isoformat(), "tool": tool_name, "args": arguments, "ok": success, "ms": latency_ms, "err": error, "src": source, "agent": agent_id, "session": session_id}
    filepath = _get_trace_file()
    with _lock:
        try:
            with open(filepath, "a", encoding="utf-8") as f: f.write(json.dumps(record, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"写入 tool_traces.jsonl 失败: {e}")
            return
        try:
            with open(filepath, "r", encoding="utf-8") as f: line_count = sum(1 for _ in f)
            if line_count > _MAX_LINES: _auto_trim(filepath)
        except Exception: pass

def _read_all_records() -> List[Dict[str, Any]]:
    filepath = _get_trace_file()
    records = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try: records.append(json.loads(line))
                    except json.JSONDecodeError: continue
    except FileNotFoundError: pass
    except Exception as e: logger.warning(f"读取 tool_traces.jsonl 失败: {e}")
    return records

def get_eval_summary() -> Dict[str, Any]:
    records = _read_all_records()
    total = len(records)
    if total == 0: return {"total_calls": 0, "success_count": 0, "fail_count": 0, "success_rate": 0.0, "avg_latency_ms": 0.0, "min_latency_ms": 0, "max_latency_ms": 0}
    success_count = sum(1 for r in records if r.get("ok"))
    latencies = [r.get("ms", 0) for r in records]
    return {"total_calls": total, "success_count": success_count, "fail_count": total - success_count, "success_rate": round(success_count / total * 100, 2), "avg_latency_ms": round(sum(latencies) / len(latencies), 2), "min_latency_ms": min(latencies), "max_latency_ms": max(latencies)}

def get_tool_stats() -> List[Dict[str, Any]]:
    records = _read_all_records()
    if not records: return []
    grouped: Dict[str, List[Dict]] = defaultdict(list)
    for r in records: grouped[r.get("tool", "unknown")].append(r)
    stats = []
    for tool_name, recs in grouped.items():
        total = len(recs)
        success = sum(1 for r in recs if r.get("ok"))
        latencies = [r.get("ms", 0) for r in recs]
        stats.append({"tool": tool_name, "total_calls": total, "success_count": success, "fail_count": total - success, "success_rate": round(success / total * 100, 2), "avg_latency_ms": round(sum(latencies) / len(latencies), 2)})
    stats.sort(key=lambda x: x["total_calls"], reverse=True)
    return stats

def get_error_patterns() -> List[Dict[str, Any]]:
    records = _read_all_records()
    if not records: return []
    failed = [r for r in records if not r.get("ok")]
    if not failed: return []
    tool_errors: Dict[str, List[str]] = defaultdict(list)
    for r in failed: tool_errors[r.get("tool", "unknown")].append(r.get("err", ""))
    sorted_tools = sorted(tool_errors.items(), key=lambda x: len(x[1]), reverse=True)
    result = []
    for tool_name, errors in sorted_tools[:5]:
        err_counter: Dict[str, int] = defaultdict(int)
        for err in errors: err_counter[err[:200] if err else "(empty)"] += 1
        top_errors = sorted(err_counter.items(), key=lambda x: x[1], reverse=True)[:5]
        result.append({"tool": tool_name, "fail_count": len(errors), "top_errors": [{"error": err, "count": cnt} for err, cnt in top_errors]})
    return result

def get_trend(days: int = 7) -> List[Dict[str, Any]]:
    records = _read_all_records()
    if not records: return []
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    daily: Dict[str, List[Dict]] = defaultdict(list)
    for r in records:
        ts_str = r.get("ts", "")
        if not ts_str: continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if ts < cutoff: continue
            daily[ts.strftime("%Y-%m-%d")].append(r)
        except (ValueError, TypeError): continue
    result = []
    for i in range(days):
        day = (cutoff + timedelta(days=i)).strftime("%Y-%m-%d")
        recs = daily.get(day, [])
        total = len(recs)
        if total == 0:
            result.append({"date": day, "total_calls": 0, "success_count": 0, "fail_count": 0, "success_rate": 0.0, "avg_latency_ms": 0.0})
        else:
            success = sum(1 for r in recs if r.get("ok"))
            latencies = [r.get("ms", 0) for r in recs]
            result.append({"date": day, "total_calls": total, "success_count": success, "fail_count": total - success, "success_rate": round(success / total * 100, 2), "avg_latency_ms": round(sum(latencies) / len(latencies), 2)})
    return result