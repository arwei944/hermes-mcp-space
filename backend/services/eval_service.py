# -*- coding: utf-8 -*-
"""
Hermes Agent - 工具调用追踪与 Evals 服务

记录每次 MCP 工具调用到 JSONL 文件，提供统计分析和趋势查询。
存储路径：~/.hermes/logs/tool_traces.jsonl
"""

import json
import logging
import os
import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes-mcp")

# ---- 常量 ----
_MAX_LINES = 10000
_TRIM_TO = 5000

# ---- 全局单例 ----
_lock = threading.Lock()


def _get_trace_file() -> Path:
    """获取追踪日志文件路径，确保目录存在。"""
    hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    log_dir = Path(hermes_home) / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir / "tool_traces.jsonl"


def _auto_trim(filepath: Path) -> None:
    """当文件超过 _MAX_LINES 行时，保留最新 _TRIM_TO 行。"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        return

    if len(lines) <= _MAX_LINES:
        return

    trimmed = lines[-_TRIM_TO:]
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(trimmed)
        logger.info(f"tool_traces.jsonl 自动清理: {len(lines)} -> {len(trimmed)} 行")
    except Exception as e:
        logger.warning(f"清理 tool_traces.jsonl 失败: {e}")


def _count_lines(filepath: Path) -> int:
    """快速统计文件行数。"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


# ============================================================
# 公开 API
# ============================================================

def record_tool_call(
    tool_name: str,
    arguments: Dict[str, Any],
    success: bool,
    latency_ms: int,
    error: str,
    source: str = "mcp",
) -> None:
    """
    记录一次工具调用。

    Args:
        tool_name:   工具名称
        arguments:   调用参数
        success:     是否成功
        latency_ms:  耗时（毫秒）
        error:       错误信息（成功时为空字符串）
        source:      调用来源（mcp / api / web）
    """
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "tool": tool_name,
        "args": arguments,
        "ok": success,
        "ms": latency_ms,
        "err": error,
        "src": source,
    }

    filepath = _get_trace_file()
    with _lock:
        try:
            with open(filepath, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"写入 tool_traces.jsonl 失败: {e}")
            return

        # 每写入一条都检查是否需要清理（简单计数）
        line_count = _count_lines(filepath)
        if line_count > _MAX_LINES:
            _auto_trim(filepath)


def _read_all_records() -> List[Dict[str, Any]]:
    """读取全部追踪记录。"""
    filepath = _get_trace_file()
    records: List[Dict[str, Any]] = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except FileNotFoundError:
        pass
    except Exception as e:
        logger.warning(f"读取 tool_traces.jsonl 失败: {e}")
    return records


def get_eval_summary() -> Dict[str, Any]:
    """
    返回总调用数、成功率、平均延迟。

    Returns:
        {
            "total_calls": int,
            "success_count": int,
            "fail_count": int,
            "success_rate": float,   # 0-100
            "avg_latency_ms": float,
            "min_latency_ms": int,
            "max_latency_ms": int,
        }
    """
    records = _read_all_records()
    total = len(records)
    if total == 0:
        return {
            "total_calls": 0,
            "success_count": 0,
            "fail_count": 0,
            "success_rate": 0.0,
            "avg_latency_ms": 0.0,
            "min_latency_ms": 0,
            "max_latency_ms": 0,
        }

    success_count = sum(1 for r in records if r.get("ok"))
    fail_count = total - success_count
    latencies = [r.get("ms", 0) for r in records]

    return {
        "total_calls": total,
        "success_count": success_count,
        "fail_count": fail_count,
        "success_rate": round(success_count / total * 100, 2),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 2),
        "min_latency_ms": min(latencies),
        "max_latency_ms": max(latencies),
    }


def get_tool_stats() -> List[Dict[str, Any]]:
    """
    按工具名称分组的详细统计。

    Returns:
        [
            {
                "tool": str,
                "total_calls": int,
                "success_count": int,
                "fail_count": int,
                "success_rate": float,
                "avg_latency_ms": float,
            },
            ...
        ]
    """
    records = _read_all_records()
    if not records:
        return []

    grouped: Dict[str, List[Dict]] = defaultdict(list)
    for r in records:
        grouped[r.get("tool", "unknown")].append(r)

    stats = []
    for tool_name, recs in grouped.items():
        total = len(recs)
        success = sum(1 for r in recs if r.get("ok"))
        latencies = [r.get("ms", 0) for r in recs]
        stats.append({
            "tool": tool_name,
            "total_calls": total,
            "success_count": success,
            "fail_count": total - success,
            "success_rate": round(success / total * 100, 2),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2),
        })

    # 按调用次数降序排列
    stats.sort(key=lambda x: x["total_calls"], reverse=True)
    return stats


def get_error_patterns() -> List[Dict[str, Any]]:
    """
    Top 5 失败工具 + 失败原因。

    Returns:
        [
            {
                "tool": str,
                "fail_count": int,
                "top_errors": [{"error": str, "count": int}, ...],
            },
            ...
        ]
    """
    records = _read_all_records()
    if not records:
        return []

    # 只看失败记录
    failed = [r for r in records if not r.get("ok")]
    if not failed:
        return []

    # 按工具分组
    tool_errors: Dict[str, List[str]] = defaultdict(list)
    for r in failed:
        tool_errors[r.get("tool", "unknown")].append(r.get("err", ""))

    # 按失败次数降序
    sorted_tools = sorted(tool_errors.items(), key=lambda x: len(x[1]), reverse=True)

    result = []
    for tool_name, errors in sorted_tools[:5]:
        # 统计每个错误信息出现次数
        err_counter: Dict[str, int] = defaultdict(int)
        for err in errors:
            # 截断过长的错误信息用于分组
            short_err = err[:200] if err else "(empty error)"
            err_counter[short_err] += 1

        top_errors = sorted(err_counter.items(), key=lambda x: x[1], reverse=True)[:5]
        result.append({
            "tool": tool_name,
            "fail_count": len(errors),
            "top_errors": [{"error": err, "count": cnt} for err, cnt in top_errors],
        })

    return result


def get_trend(days: int = 7) -> List[Dict[str, Any]]:
    """
    过去 N 天的调用趋势，按日期分组。

    Args:
        days: 回溯天数（默认 7）

    Returns:
        [
            {
                "date": "2026-04-29",
                "total_calls": int,
                "success_count": int,
                "fail_count": int,
                "success_rate": float,
                "avg_latency_ms": float,
            },
            ...
        ]
    """
    records = _read_all_records()
    if not records:
        return []

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    # 按日期分组
    daily: Dict[str, List[Dict]] = defaultdict(list)
    for r in records:
        ts_str = r.get("ts", "")
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if ts < cutoff:
                continue
            date_key = ts.strftime("%Y-%m-%d")
            daily[date_key].append(r)
        except (ValueError, TypeError):
            continue

    # 生成从 cutoff 到今天的完整日期列表（填充空白天）
    result = []
    for i in range(days):
        day = (cutoff + timedelta(days=i)).strftime("%Y-%m-%d")
        recs = daily.get(day, [])
        total = len(recs)
        if total == 0:
            result.append({
                "date": day,
                "total_calls": 0,
                "success_count": 0,
                "fail_count": 0,
                "success_rate": 0.0,
                "avg_latency_ms": 0.0,
            })
        else:
            success = sum(1 for r in recs if r.get("ok"))
            latencies = [r.get("ms", 0) for r in recs]
            result.append({
                "date": day,
                "total_calls": total,
                "success_count": success,
                "fail_count": total - success,
                "success_rate": round(success / total * 100, 2),
                "avg_latency_ms": round(sum(latencies) / len(latencies), 2),
            })

    return result
