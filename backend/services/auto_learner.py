# -*- coding: utf-8 -*-
"""Hermes Agent - 自动提炼引擎

从 tool_traces.jsonl + logs.json + sessions.json 中自动分析。
触发时机：每次 MCP tools/call 后异步触发（增量），/api/knowledge/auto-learn 手动触发（全量）。
"""

import json, logging, os, re, threading
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.services import eval_service
from backend.routers.logs import _load_logs

logger = logging.getLogger("hermes-mcp")
_lock = threading.Lock()
_last_learn_ts: float = 0
_COOLDOWN = 300

def get_hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))

def analyze_errors() -> List[Dict[str, Any]]:
    records = eval_service._read_all_records()
    errors = [r for r in records if not r.get("ok")]
    if not errors: return []
    patterns = defaultdict(list)
    for e in errors:
        tool, err = e.get("tool", "unknown"), e.get("err", "")
        patterns[f"{tool}:{_extract_error_type(err)}"].append(e)
    results = []
    for key, items in patterns.items():
        tool, err_type = key.split(":", 1)
        count = len(items)
        latest = items[-1]
        tool_successes = [r for r in records if r.get("tool") == tool and r.get("ok")]
        is_fixed = False
        if tool_successes:
            last_fail_ts = latest.get("ts", "")
            last_ok_ts = tool_successes[-1].get("ts", "")
            if last_fail_ts and last_ok_ts and last_ok_ts > last_fail_ts: is_fixed = True
        results.append({"tool": tool, "error_type": err_type, "count": count, "latest_err": (latest.get("err", "") or "")[:200], "latest_ts": latest.get("ts", ""), "is_fixed": is_fixed, "severity": "high" if count >= 5 else "medium" if count >= 3 else "low"})
    results.sort(key=lambda x: (0 if x["severity"] == "high" else 1 if x["severity"] == "medium" else 2), reverse=True)
    return results

def _extract_error_type(err: str) -> str:
    if not err: return "unknown"
    err_lower = err.lower()
    for pattern, label in [(r"SSL", "SSL错误"), (r"timeout|timed out", "超时"), (r"404|not found", "404未找到"), (r"401|unauthorized", "认证失败"), (r"500|internal server", "服务器错误"), (r"connection refused", "连接拒绝"), (r"key\s*error|attribute\s*error", "属性/键错误"), (r"syntax\s*error", "语法错误"), (r"type\s*error", "类型错误"), (r"import\s*error", "模块缺失"), (r"permission|denied", "权限不足")]:
        if re.search(pattern, err_lower): return label
    first_line = err.split("\n")[0].strip()
    return first_line[:30] if first_line else "unknown"

def analyze_patterns() -> List[Dict[str, Any]]:
    records = eval_service._read_all_records()
    stats = eval_service.get_tool_stats()
    results = []
    for s in stats:
        tool = s.get("tool", "")
        total, rate = s.get("total_calls", 0), s.get("success_rate", 0)
        if total >= 3 and rate >= 90:
            successes = [r for r in records if r.get("tool") == tool and r.get("ok")]
            if successes:
                avg_ms = sum(r.get("ms", 0) for r in successes[-10:]) / min(len(successes), 10)
                results.append({"tool": tool, "total_calls": total, "success_rate": rate, "avg_latency_ms": round(avg_ms, 1), "recommendation": f"工具 {tool} 调用稳定（{rate}%成功率），可考虑封装为技能"})
    return results

def analyze_preferences() -> List[Dict[str, Any]]:
    logs = _load_logs()
    if not logs: return []
    prefs = []
    tool_counter = Counter()
    for log in logs:
        action = log.get("action", "")
        if "MCP 调用:" in action:
            tool_counter[action.replace("MCP 调用:", "").strip()] += 1
    top_tools = tool_counter.most_common(5)
    if top_tools:
        pref_str = "、".join([f"{t[0]}({t[1]}次)" for t in top_tools])
        prefs.append({"category": "常用工具", "content": f"用户最常使用的工具：{pref_str}", "confidence": "high"})
    return prefs

def suggest_skills() -> List[Dict[str, Any]]:
    records = eval_service._read_all_records()
    stats = eval_service.get_tool_stats()
    suggestions = []
    tool_sequence = [r.get("tool", "") for r in records if r.get("ok")]
    combo_counter = Counter()
    for i in range(len(tool_sequence) - 2):
        combo = f"{tool_sequence[i]} → {tool_sequence[i+1]}"
        combo_counter[combo] += 1
    for combo, count in combo_counter.most_common(5):
        if count >= 3:
            tools = combo.split(" → ")
            suggestions.append({"type": "composite", "name": f"auto-{tools[0]}-then-{tools[1]}", "description": f"复合技能（已出现{count}次）", "tools": tools, "frequency": count})
    for s in stats:
        tool = s.get("tool", "")
        if s.get("total_calls", 0) >= 10:
            suggestions.append({"type": "wrapper", "name": f"auto-{tool}-shortcut", "description": f"快捷技能（{s['total_calls']}次调用）", "tools": [tool], "frequency": s["total_calls"]})
    return suggestions

def run_full_learning() -> Dict[str, Any]:
    hermes_home = get_hermes_home()
    learnings_path = hermes_home / "learnings.md"
    memory_path = hermes_home / "memories" / "MEMORY.md"
    existing_learnings = learnings_path.read_text(encoding="utf-8", errors="replace") if learnings_path.exists() else ""
    existing_memory = memory_path.read_text(encoding="utf-8", errors="replace") if memory_path.exists() else ""
    errors, patterns, preferences, skill_suggestions = analyze_errors(), analyze_patterns(), analyze_preferences(), suggest_skills()
    new_sections = []
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    if errors:
        section = f"\n## 🔴 错误模式（自动分析 {now_str}）\n\n"
        for e in errors[:10]:
            status = "✅ 已修复" if e["is_fixed"] else "⚠️ 未修复"
            section += f"### {e['tool']} — {e['error_type']}\n- 出现次数：{e['count']}（{e['severity']}）\n- 状态：{status}\n- 最新错误：`{e['latest_err']}`\n\n"
        new_sections.append(section)
    if patterns:
        section = f"\n## 🟢 最佳实践（自动分析 {now_str}）\n\n"
        for p in patterns[:5]: section += f"### {p['tool']}\n- 成功率：{p['success_rate']}%（{p['total_calls']}次）\n- 平均延迟：{p['avg_latency_ms']}ms\n\n"
        new_sections.append(section)
    if new_sections:
        final_learnings = _merge_learnings(existing_learnings, "\n".join(new_sections))
        learnings_path.parent.mkdir(parents=True, exist_ok=True)
        learnings_path.write_text(final_learnings, encoding="utf-8")
    if preferences:
        pref_section = f"\n## 📊 用户偏好（自动分析 {now_str}）\n\n"
        for p in preferences: pref_section += f"- **{p['category']}**：{p['content']}\n"
        new_memory = _merge_memory(existing_memory, pref_section)
        memory_path.parent.mkdir(parents=True, exist_ok=True)
        memory_path.write_text(new_memory, encoding="utf-8")
    return {"errors_found": len(errors), "patterns_found": len(patterns), "preferences_found": len(preferences), "skills_suggested": len(skill_suggestions), "learnings_updated": bool(new_sections), "memory_updated": bool(preferences), "timestamp": now_str}

def run_incremental_learning(tool_name: str, ok: bool, err: str = "") -> Optional[Dict[str, Any]]:
    global _last_learn_ts
    import time
    now = time.time()
    if now - _last_learn_ts < _COOLDOWN: return None
    _last_learn_ts = now
    records = eval_service._read_all_records()
    recent_records = [r for r in records[-50:] if r.get("tool") == tool_name]
    if ok:
        recent_success = [r for r in recent_records if r.get("ok")]
        if len(recent_success) < 5: return None
        hermes_home = get_hermes_home()
        learnings_path = hermes_home / "learnings.md"
        existing = learnings_path.read_text(encoding="utf-8", errors="replace") if learnings_path.exists() else ""
        if f"✅ {tool_name} — 最佳实践" in existing: return None
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        section = f"\n## ✅ {tool_name} — 最佳实践（自动检测 {now_str}）\n\n- 连续成功次数：{len(recent_success)}\n- 状态：✅ 稳定可用\n\n"
        final = _merge_learnings(existing, section)
        learnings_path.parent.mkdir(parents=True, exist_ok=True)
        learnings_path.write_text(final, encoding="utf-8")
        logger.info(f"自动学习：记录最佳实践 {tool_name}")
        return {"recorded": True, "tool": tool_name, "type": "best_practice"}
    else:
        recent_errors = [r for r in recent_records if not r.get("ok")]
        if len(recent_errors) < 2: return None
    hermes_home = get_hermes_home()
    learnings_path = hermes_home / "learnings.md"
    existing = learnings_path.read_text(encoding="utf-8", errors="replace") if learnings_path.exists() else ""
    err_type = _extract_error_type(err)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    if f"{tool_name} — {err_type}" in existing: return None
    section = f"\n## 🔴 {tool_name} — {err_type}（自动检测 {now_str}）\n\n- 出现次数：{len(recent_errors)}\n- 最新错误：`{(err or '')[:200]}`\n- 状态：⚠️ 未修复\n\n"
    final = _merge_learnings(existing, section)
    learnings_path.parent.mkdir(parents=True, exist_ok=True)
    learnings_path.write_text(final, encoding="utf-8")
    logger.info(f"自动学习：记录错误模式 {tool_name} — {err_type}")
    return {"recorded": True, "tool": tool_name, "error_type": err_type}

def _merge_learnings(existing: str, new_sections: str) -> str:
    new_titles = re.findall(r"^## (.+?)（自动", new_sections, re.MULTILINE)
    lines = existing.split("\n")
    filtered, skip = [], False
    for line in lines:
        if line.startswith("## ") and any(t in line for t in new_titles): skip = True; continue
        if skip and line.startswith("## ") and not any(t in line for t in new_titles): skip = False
        if not skip: filtered.append(line)
    return "\n".join(filtered).rstrip() + "\n" + new_sections

def _merge_memory(existing: str, new_section: str) -> str:
    marker = "## 📊 用户偏好"
    if marker in existing:
        lines = existing.split("\n")
        filtered, skip = [], False
        for line in lines:
            if marker in line: skip = True; continue
            if skip and line.startswith("## "): skip = False
            if not skip: filtered.append(line)
        return "\n".join(filtered).rstrip() + "\n" + new_section
    return existing.rstrip() + "\n" + new_section