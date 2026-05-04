# -*- coding: utf-8 -*-
"""运维监控服务

提供系统资源监控、MCP 服务健康监控、定时任务监控和告警引擎功能。
- 系统资源：通过 psutil 采集 CPU/内存/磁盘/网络，保留最近 360 个采样点（1 小时）
- MCP 健康：读取 tool_traces.jsonl 统计工具调用成功率和响应时间
- 定时任务：读取 cron jobs 状态
- 告警引擎：基于规则的告警检查与通知
"""

import json
import logging
import time
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes-mcp")

# ---- 常量 ----
_HISTORY_MAXLEN = 360          # 1 小时历史（每 10 秒采样）
_SAMPLE_INTERVAL = 10           # 采样间隔（秒）
_ALERT_HISTORY_MAXLEN = 200     # 告警历史最大条数
_ALERT_RULES_FILE = "alert_rules.json"
_ALERT_HISTORY_FILE = "alert_history.json"

# ---- 历史数据存储 ----
_metrics_history: deque = deque(maxlen=_HISTORY_MAXLEN)
_last_sample_time: float = 0.0


def _now_iso() -> str:
    """返回当前 UTC 时间 ISO 格式字符串"""
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# 1. 系统资源监控
# ============================================================

def _collect_metrics() -> Dict[str, Any]:
    """采集一次系统指标快照"""
    snapshot: Dict[str, Any] = {
        "timestamp": _now_iso(),
        "cpu_percent": 0.0,
        "memory_percent": 0.0,
        "memory_used_mb": 0.0,
        "memory_total_mb": 0.0,
        "disk_percent": 0.0,
        "disk_used_gb": 0.0,
        "disk_total_gb": 0.0,
        "net_bytes_sent": 0,
        "net_bytes_recv": 0,
        "psutil_available": False,
    }

    try:
        import psutil

        snapshot["psutil_available"] = True

        # CPU
        snapshot["cpu_percent"] = psutil.cpu_percent(interval=0.3)

        # 内存
        mem = psutil.virtual_memory()
        snapshot["memory_percent"] = mem.percent
        snapshot["memory_used_mb"] = round(mem.used / 1024 / 1024, 2)
        snapshot["memory_total_mb"] = round(mem.total / 1024 / 1024, 2)

        # 磁盘（根分区）
        disk = psutil.disk_usage("/")
        snapshot["disk_percent"] = disk.percent
        snapshot["disk_used_gb"] = round(disk.used / 1024 / 1024 / 1024, 2)
        snapshot["disk_total_gb"] = round(disk.total / 1024 / 1024 / 1024, 2)

        # 网络 I/O（累计值）
        net = psutil.net_io_counters()
        snapshot["net_bytes_sent"] = net.bytes_sent
        snapshot["net_bytes_recv"] = net.bytes_recv

    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"采集系统指标失败: {e}")

    return snapshot


def _maybe_sample() -> None:
    """如果距离上次采样已超过间隔，则采样并记录"""
    global _last_sample_time
    now = time.time()
    if now - _last_sample_time >= _SAMPLE_INTERVAL:
        snapshot = _collect_metrics()
        _metrics_history.append(snapshot)
        _last_sample_time = now


def get_system_metrics() -> Dict[str, Any]:
    """返回当前实时系统指标

    Returns:
        包含 cpu_percent, memory_percent, disk_percent, network_io 等字段的字典
    """
    _maybe_sample()
    snapshot = _collect_metrics()
    return snapshot


def get_system_history(minutes: int = 10) -> List[Dict[str, Any]]:
    """返回历史趋势数据

    Args:
        minutes: 回溯分钟数（默认 10）

    Returns:
        指标快照列表，按时间升序
    """
    _maybe_sample()
    cutoff = time.time() - minutes * 60
    result = []
    for snap in _metrics_history:
        try:
            ts = datetime.fromisoformat(snap["timestamp"]).timestamp()
            if ts >= cutoff:
                result.append(snap)
        except (ValueError, TypeError):
            continue
    return result


# ============================================================
# 2. MCP 服务健康监控
# ============================================================

def get_mcp_health() -> Dict[str, Any]:
    """返回 MCP 服务健康状态

    读取 tool_traces.jsonl 计算成功率、平均响应时间、错误率趋势。

    Returns:
        {
            "status": "healthy" | "degraded" | "unhealthy",
            "total_calls": int,
            "success_rate": float,
            "avg_latency_ms": float,
            "recent_error_rate": float,
            "error_rate_trend": "improving" | "stable" | "worsening",
            "mcp_connected": bool,
        }
    """
    try:
        from backend.services import eval_service
        from backend.services.hermes_service import hermes_service
    except ImportError:
        return {"status": "unknown", "error": "服务模块不可用"}

    summary = eval_service.get_eval_summary()
    total = summary["total_calls"]
    success_rate = summary["success_rate"]
    avg_latency = summary["avg_latency_ms"]

    # 计算最近 1 小时错误率
    records = eval_service._read_all_records()
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)
    recent_records = []
    for r in records:
        ts_str = r.get("ts", "")
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if ts >= one_hour_ago:
                recent_records.append(r)
        except (ValueError, TypeError):
            continue

    recent_total = len(recent_records)
    recent_errors = sum(1 for r in recent_records if not r.get("ok"))
    recent_error_rate = round(recent_errors / recent_total * 100, 2) if recent_total > 0 else 0.0

    # 错误率趋势：比较前半小时和后半小时
    half_hour_ago = now - timedelta(minutes=30)
    older_records = []
    newer_records = []
    for r in records:
        ts_str = r.get("ts", "")
        if not ts_str:
            continue
        try:
            ts = datetime.fromisoformat(ts_str)
            if one_hour_ago <= ts < half_hour_ago:
                older_records.append(r)
            elif ts >= half_hour_ago:
                newer_records.append(r)
        except (ValueError, TypeError):
            continue

    older_err_rate = (
        sum(1 for r in older_records if not r.get("ok")) / len(older_records) * 100
        if older_records else 0.0
    )
    newer_err_rate = (
        sum(1 for r in newer_records if not r.get("ok")) / len(newer_records) * 100
        if newer_records else 0.0
    )

    if newer_err_rate < older_err_rate - 5:
        trend = "improving"
    elif newer_err_rate > older_err_rate + 5:
        trend = "worsening"
    else:
        trend = "stable"

    # MCP 连接状态
    mcp_status = hermes_service.get_mcp_status()
    mcp_connected = mcp_status.get("status") == "running"

    # 综合健康判定
    if not mcp_connected:
        status = "unhealthy"
    elif success_rate < 50 or recent_error_rate > 50:
        status = "unhealthy"
    elif success_rate < 80 or recent_error_rate > 20:
        status = "degraded"
    else:
        status = "healthy"

    return {
        "status": status,
        "total_calls": total,
        "success_rate": success_rate,
        "avg_latency_ms": avg_latency,
        "recent_error_rate": recent_error_rate,
        "error_rate_trend": trend,
        "mcp_connected": mcp_connected,
    }


def get_tool_stats() -> List[Dict[str, Any]]:
    """返回工具级调用统计（按工具分组）

    Returns:
        [{tool, total_calls, success_count, fail_count, success_rate, avg_latency_ms}, ...]
    """
    try:
        from backend.services import eval_service
    except ImportError:
        return []
    return eval_service.get_tool_stats()


# ============================================================
# 3. 定时任务监控
# ============================================================

def get_cron_monitor() -> Dict[str, Any]:
    """返回定时任务监控状态

    Returns:
        {
            "total": int,
            "active": int,
            "paused": int,
            "success_count": int,
            "fail_count": int,
            "jobs": [...],
        }
    """
    try:
        from backend.services.hermes_service import hermes_service
    except ImportError:
        return {"total": 0, "active": 0, "paused": 0, "success_count": 0, "fail_count": 0, "jobs": []}

    jobs = hermes_service.list_cron_jobs()
    active = sum(1 for j in jobs if j.get("enabled", True) and j.get("status") == "active")
    paused = len(jobs) - active

    # 统计成功/失败次数（基于 last_run_status 或运行历史）
    success_count = 0
    fail_count = 0
    for job in jobs:
        # 兼容不同的状态字段命名
        run_status = job.get("last_run_status", job.get("status", ""))
        if run_status == "success":
            success_count += 1
        elif run_status == "failed":
            fail_count += 1

    return {
        "total": len(jobs),
        "active": active,
        "paused": paused,
        "success_count": success_count,
        "fail_count": fail_count,
        "jobs": jobs,
    }


# ============================================================
# 4. 告警引擎
# ============================================================

def _get_data_dir() -> Path:
    """获取告警数据目录"""
    try:
        from backend.config import get_hermes_home
        data_dir = get_hermes_home() / "data"
    except ImportError:
        data_dir = Path.home() / ".hermes" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _load_alert_rules() -> List[Dict[str, Any]]:
    """加载告警规则列表"""
    rules_path = _get_data_dir() / _ALERT_RULES_FILE
    if not rules_path.exists():
        return []
    try:
        return json.loads(rules_path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_alert_rules(rules: List[Dict[str, Any]]) -> bool:
    """保存告警规则列表"""
    try:
        _get_data_dir() / _ALERT_RULES_FILE
        (_get_data_dir() / _ALERT_RULES_FILE).write_text(
            json.dumps(rules, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return True
    except Exception as e:
        logger.warning(f"保存告警规则失败: {e}")
        return False


def _load_alert_history() -> List[Dict[str, Any]]:
    """加载告警历史"""
    history_path = _get_data_dir() / _ALERT_HISTORY_FILE
    if not history_path.exists():
        return []
    try:
        return json.loads(history_path.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_alert_history(history: List[Dict[str, Any]]) -> bool:
    """保存告警历史（超过上限自动裁剪）"""
    if len(history) > _ALERT_HISTORY_MAXLEN:
        history = history[-_ALERT_HISTORY_MAXLEN:]
    try:
        (_get_data_dir() / _ALERT_HISTORY_FILE).write_text(
            json.dumps(history, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return True
    except Exception as e:
        logger.warning(f"保存告警历史失败: {e}")
        return False


def _append_alert_history(alert: Dict[str, Any]) -> None:
    """追加一条告警到历史"""
    history = _load_alert_history()
    history.append(alert)
    _save_alert_history(history)


# ---- 告警规则 CRUD ----

def list_alert_rules() -> List[Dict[str, Any]]:
    """列出所有告警规则"""
    return _load_alert_rules()


def create_alert_rule(rule: Dict[str, Any]) -> Dict[str, Any]:
    """创建告警规则

    Args:
        rule: 包含 name, type, threshold, enabled, cooldown 的字典

    Returns:
        {success, message, rule}
    """
    rules = _load_alert_rules()
    rule_id = rule.get("id", str(uuid.uuid4())[:8])
    rule["id"] = rule_id
    rule["created_at"] = _now_iso()
    rule["last_triggered"] = None
    rule.setdefault("enabled", True)
    rule.setdefault("cooldown", 300)  # 默认冷却 5 分钟
    rules.append(rule)
    if _save_alert_rules(rules):
        return {"success": True, "message": "告警规则创建成功", "rule": rule}
    return {"success": False, "message": "保存告警规则失败"}


def update_alert_rule(rule_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """更新告警规则

    Args:
        rule_id: 规则 ID
        updates: 要更新的字段

    Returns:
        {success, message, rule}
    """
    rules = _load_alert_rules()
    for i, r in enumerate(rules):
        if r.get("id") == rule_id:
            r.update(updates)
            r["updated_at"] = _now_iso()
            rules[i] = r
            if _save_alert_rules(rules):
                return {"success": True, "message": "告警规则更新成功", "rule": r}
            return {"success": False, "message": "保存告警规则失败"}
    return {"success": False, "message": f"告警规则 {rule_id} 不存在"}


def delete_alert_rule(rule_id: str) -> Dict[str, Any]:
    """删除告警规则

    Args:
        rule_id: 规则 ID

    Returns:
        {success, message}
    """
    rules = _load_alert_rules()
    new_rules = [r for r in rules if r.get("id") != rule_id]
    if len(new_rules) == len(rules):
        return {"success": False, "message": f"告警规则 {rule_id} 不存在"}
    if _save_alert_rules(new_rules):
        return {"success": True, "message": f"告警规则 {rule_id} 已删除"}
    return {"success": False, "message": "保存告警规则失败"}


# ---- 告警历史 ----

def list_alert_history(limit: int = 50) -> List[Dict[str, Any]]:
    """列出告警历史（最新的在前）

    Args:
        limit: 返回条数上限

    Returns:
        告警记录列表
    """
    history = _load_alert_history()
    history.reverse()
    return history[:limit]


def acknowledge_alert(alert_id: str) -> Dict[str, Any]:
    """确认告警

    Args:
        alert_id: 告警 ID

    Returns:
        {success, message}
    """
    history = _load_alert_history()
    found = False
    for h in history:
        if h.get("id") == alert_id:
            h["acknowledged"] = True
            h["acknowledged_at"] = _now_iso()
            found = True
            break
    if not found:
        return {"success": False, "message": f"告警 {alert_id} 不存在"}
    if _save_alert_history(history):
        return {"success": True, "message": f"告警 {alert_id} 已确认"}
    return {"success": False, "message": "保存告警历史失败"}


# ---- 告警检查 ----

def check_alerts() -> List[Dict[str, Any]]:
    """检查所有启用的告警规则，触发时发送 SSE 事件

    Returns:
        本次触发的告警列表
    """
    rules = _load_alert_rules()
    triggered = []
    now = time.time()

    for rule in rules:
        if not rule.get("enabled", True):
            continue

        alert_type = rule.get("type", "")
        threshold = rule.get("threshold", 0)
        cooldown = rule.get("cooldown", 300)

        # 检查冷却时间
        last_triggered = rule.get("last_triggered")
        if last_triggered:
            try:
                last_ts = datetime.fromisoformat(last_triggered).timestamp()
                if now - last_ts < cooldown:
                    continue
            except (ValueError, TypeError):
                pass

        # 根据告警类型获取当前值
        current_value = _get_alert_value(alert_type)
        if current_value is None:
            continue

        # 判断是否触发（值超过阈值）
        fired = False
        if alert_type in ("cpu_high", "memory_high", "disk_high", "tool_error_rate"):
            fired = current_value >= threshold
        elif alert_type == "mcp_disconnected":
            fired = current_value  # bool: True 表示断开

        if not fired:
            continue

        # 构造告警记录
        alert_id = str(uuid.uuid4())[:8]
        alert = {
            "id": alert_id,
            "rule_id": rule.get("id"),
            "rule_name": rule.get("name", alert_type),
            "type": alert_type,
            "threshold": threshold,
            "current_value": current_value,
            "message": _build_alert_message(alert_type, threshold, current_value),
            "triggered_at": _now_iso(),
            "acknowledged": False,
        }

        # 更新规则的 last_triggered
        rule["last_triggered"] = _now_iso()

        # 追加到历史
        _append_alert_history(alert)
        triggered.append(alert)

        # 发送 SSE 事件
        try:
            from backend.routers.events import emit_event
            emit_event("ops.alert", alert, source="ops")
        except ImportError:
            logger.warning("emit_event 不可用，跳过 SSE 推送")
        except Exception as e:
            logger.warning(f"发送告警 SSE 事件失败: {e}")

        # Auto-send notification on alert
        try:
            from backend.mcp.tools.system.send_notification import handle as notify_handle
            notify_handle({
                "title": f"Alert: {alert.get('rule_name', 'Unknown')}",
                "message": f"{alert.get('message', '')}\nSeverity: {alert.get('type', 'unknown')}",
                "level": alert.get("type", "warning"),
            })
        except Exception:
            pass

    # 保存更新后的规则（更新 last_triggered）
    if triggered:
        _save_alert_rules(rules)

    return triggered


def _get_alert_value(alert_type: str) -> Optional[float]:
    """根据告警类型获取当前监控值

    Args:
        alert_type: 告警类型

    Returns:
        当前值（float 或 bool），获取失败返回 None
    """
    try:
        if alert_type == "cpu_high":
            metrics = get_system_metrics()
            return metrics.get("cpu_percent", 0)
        elif alert_type == "memory_high":
            metrics = get_system_metrics()
            return metrics.get("memory_percent", 0)
        elif alert_type == "disk_high":
            metrics = get_system_metrics()
            return metrics.get("disk_percent", 0)
        elif alert_type == "tool_error_rate":
            health = get_mcp_health()
            return health.get("recent_error_rate", 0)
        elif alert_type == "mcp_disconnected":
            health = get_mcp_health()
            return 1.0 if not health.get("mcp_connected", True) else 0.0
    except Exception as e:
        logger.warning(f"获取告警值失败 ({alert_type}): {e}")
    return None


def _build_alert_message(alert_type: str, threshold: float, current_value: float) -> str:
    """构造告警消息文本"""
    messages = {
        "cpu_high": f"CPU 使用率过高: {current_value:.1f}% (阈值: {threshold}%)",
        "memory_high": f"内存使用率过高: {current_value:.1f}% (阈值: {threshold}%)",
        "disk_high": f"磁盘使用率过高: {current_value:.1f}% (阈值: {threshold}%)",
        "tool_error_rate": f"工具错误率过高: {current_value:.1f}% (阈值: {threshold}%)",
        "mcp_disconnected": "MCP 服务连接已断开",
    }
    return messages.get(alert_type, f"告警触发: {alert_type} = {current_value}")
