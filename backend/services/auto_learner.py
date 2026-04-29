# -*- coding: utf-8 -*-
"""
Hermes Agent - 自动提炼引擎

从 tool_traces.jsonl + logs.json + sessions.json 中自动分析：
1. 错误模式 → 记录到 learnings.md（已知问题）
2. 成功模式 → 记录到 learnings.md（最佳实践）
3. 用户偏好 → 记录到 MEMORY.md
4. 技能建议 → 生成技能草稿
5. 会话摘要 → 自动压缩长会话

触发时机：
- 每次 MCP tools/call 后异步触发（增量）
- /api/knowledge/auto-learn 手动触发（全量）
"""

import json
import logging
import os
import re
import threading
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.services import eval_service
from backend.routers.logs import _load_logs

logger = logging.getLogger("hermes-mcp")

_lock = threading.Lock()
_last_learn_ts: float = 0  # 上次全量学习时间戳
_COOLDOWN = 300  # 增量学习冷却时间（秒）


def get_hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes")))


# ============================================================
# 1. 错误模式分析
# ============================================================

def analyze_errors() -> List[Dict[str, Any]]:
    """分析最近的工具调用错误，提取错误模式"""
    records = eval_service._read_all_records()
    errors = [r for r in records if not r.get("ok")]

    if not errors:
        return []

    # 按工具名 + 错误类型分组
    patterns = defaultdict(list)
    for e in errors:
        tool = e.get("tool", "unknown")
        err = e.get("err", "")
        # 提取错误类型（取第一行或关键短语）
        err_type = _extract_error_type(err)
        key = f"{tool}:{err_type}"
        patterns[key].append(e)

    results = []
    for key, items in patterns.items():
        tool, err_type = key.split(":", 1)
        count = len(items)
        latest = items[-1]
        # 判断是否已修复（最后一次成功 > 最后一次失败）
        tool_successes = [r for r in records if r.get("tool") == tool and r.get("ok")]
        is_fixed = False
        if tool_successes:
            last_fail_ts = latest.get("ts", "")
            last_ok_ts = tool_successes[-1].get("ts", "")
            if last_fail_ts and last_ok_ts and last_ok_ts > last_fail_ts:
                is_fixed = True

        results.append({
            "tool": tool,
            "error_type": err_type,
            "count": count,
            "latest_err": (latest.get("err", "") or "")[:200],
            "latest_ts": latest.get("ts", ""),
            "is_fixed": is_fixed,
            "severity": "high" if count >= 5 else "medium" if count >= 3 else "low",
        })

    # 按严重程度排序
    results.sort(key=lambda x: (0 if x["severity"] == "high" else 1 if x["severity"] == "medium" else 2), reverse=True)
    return results


def _extract_error_type(err: str) -> str:
    """从错误信息中提取类型关键词"""
    if not err:
        return "unknown"
    err_lower = err.lower()
    # 常见错误类型
    patterns = [
        (r"SSL", "SSL错误"),
        (r"timeout|timed out", "超时"),
        (r"404|not found", "404未找到"),
        (r"401|unauthorized|authentication", "认证失败"),
        (r"500|internal server", "服务器错误"),
        (r"connection refused", "连接拒绝"),
        (r"key\s*error|attribute\s*error", "属性/键错误"),
        (r"syntax\s*error", "语法错误"),
        (r"type\s*error", "类型错误"),
        (r"import\s*error|module\s*not\s*found", "模块缺失"),
        (r"permission|denied", "权限不足"),
        (r"no\s+space|disk", "磁盘空间"),
        (r"memory|oom", "内存不足"),
    ]
    for pattern, label in patterns:
        if re.search(pattern, err_lower):
            return label
    # 取第一行前30字
    first_line = err.split("\n")[0].strip()
    return first_line[:30] if first_line else "unknown"


# ============================================================
# 2. 成功模式分析（最佳实践）
# ============================================================

def analyze_patterns() -> List[Dict[str, Any]]:
    """分析高频成功的工具调用模式"""
    records = eval_service._read_all_records()
    stats = eval_service.get_tool_stats()

    results = []
    for s in stats:
        tool = s.get("tool", "")
        total = s.get("total_calls", 0)
        success = s.get("success_count", 0)
        rate = s.get("success_rate", 0)

        if total >= 3 and rate >= 90:
            # 提取成功调用的参数模式
            successes = [r for r in records if r.get("tool") == tool and r.get("ok")]
            if successes:
                avg_ms = sum(r.get("ms", 0) for r in successes[-10:]) / min(len(successes), 10)
                # 提取典型参数
                sample_args = successes[-1].get("args", {})
                results.append({
                    "tool": tool,
                    "total_calls": total,
                    "success_rate": rate,
                    "avg_latency_ms": round(avg_ms, 1),
                    "sample_args": _summarize_dict(sample_args, 100),
                    "recommendation": f"工具 {tool} 调用稳定（{rate}%成功率，平均{avg_ms:.0f}ms），可考虑封装为技能",
                })

    return results


# ============================================================
# 3. 用户偏好分析
# ============================================================

def analyze_preferences() -> List[Dict[str, Any]]:
    """从操作日志中分析用户偏好"""
    logs = _load_logs()
    if not logs:
        return []

    prefs = []

    # 1. 最常用工具 TOP 5
    tool_counter = Counter()
    for log in logs:
        action = log.get("action", "")
        if "MCP 调用:" in action:
            tool_name = action.replace("MCP 调用:", "").strip()
            tool_counter[tool_name] += 1

    top_tools = tool_counter.most_common(5)
    if top_tools:
        pref_str = "、".join([f"{t[0]}({t[1]}次)" for t in top_tools])
        prefs.append({
            "category": "常用工具",
            "content": f"用户最常使用的工具：{pref_str}",
            "confidence": "high",
        })

    # 2. 操作频率分析
    hour_counter = Counter()
    for log in logs:
        ts = log.get("timestamp", "")
        if ts:
            try:
                dt = datetime.fromisoformat(ts)
                hour_counter[dt.hour] += 1
            except (ValueError, TypeError):
                pass

    if hour_counter:
        peak_hour = hour_counter.most_common(3)
        peak_str = "、".join([f"{h[0]}:00({h[1]}次)" for h in peak_hour])
        prefs.append({
            "category": "活跃时段",
            "content": f"用户最活跃时段：{peak_str}（北京时间需+8）",
            "confidence": "medium",
        })

    # 3. 错误容忍度（失败后是否立即重试）
    error_then_retry = 0
    for i in range(len(logs) - 1):
        if "失败" in logs[i].get("detail", "") or "error" in logs[i].get("level", ""):
            next_action = logs[i + 1].get("action", "") if i + 1 < len(logs) else ""
            if next_action:
                error_then_retry += 1

    total_errors = sum(1 for l in logs if l.get("level") == "error")
    if total_errors > 0:
        retry_rate = error_then_retry / total_errors * 100
        prefs.append({
            "category": "调试习惯",
            "content": f"错误后立即重试率：{retry_rate:.0f}%（共{total_errors}次错误）",
            "confidence": "low",
        })

    return prefs


# ============================================================
# 4. 技能建议
# ============================================================

def suggest_skills() -> List[Dict[str, Any]]:
    """基于调用模式生成技能建议"""
    records = eval_service._read_all_records()
    stats = eval_service.get_tool_stats()

    suggestions = []

    # 1. 高频工具组合 → 复合技能
    tool_sequence = [r.get("tool", "") for r in records if r.get("ok")]
    # 滑动窗口找连续组合
    combo_counter = Counter()
    for i in range(len(tool_sequence) - 2):
        combo = f"{tool_sequence[i]} → {tool_sequence[i+1]}"
        combo_counter[combo] += 1

    for combo, count in combo_counter.most_common(5):
        if count >= 3:
            tools = combo.split(" → ")
            suggestions.append({
                "type": "composite",
                "name": f"auto-{tools[0]}-then-{tools[1]}",
                "description": f"复合技能：先调用 {tools[0]} 再调用 {tools[1]}（已出现{count}次）",
                "tools": tools,
                "frequency": count,
            })

    # 2. 高频单独工具 → 封装技能
    for s in stats:
        tool = s.get("tool", "")
        total = s.get("total_calls", 0)
        if total >= 10:
            suggestions.append({
                "type": "wrapper",
                "name": f"auto-{tool}-shortcut",
                "description": f"快捷技能：{tool} 已被调用{total}次，可封装常用参数组合",
                "tools": [tool],
                "frequency": total,
            })

    return suggestions


# ============================================================
# 5. 全量学习（写入文件）
# ============================================================

def run_full_learning() -> Dict[str, Any]:
    """执行全量学习，将分析结果写入 learnings.md 和 MEMORY.md"""
    hermes_home = get_hermes_home()
    learnings_path = hermes_home / "learnings.md"
    memory_path = hermes_home / "memories" / "MEMORY.md"

    # 读取现有内容
    existing_learnings = learnings_path.read_text(encoding="utf-8", errors="replace") if learnings_path.exists() else ""
    existing_memory = memory_path.read_text(encoding="utf-8", errors="replace") if memory_path.exists() else ""

    # 分析
    errors = analyze_errors()
    patterns = analyze_patterns()
    preferences = analyze_preferences()
    skill_suggestions = suggest_skills()

    # ---- 写入 learnings.md ----
    new_sections = []
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    # 错误模式
    if errors:
        error_section = f"\n## 🔴 错误模式（自动分析 {now_str}）\n\n"
        for e in errors[:10]:
            status = "✅ 已修复" if e["is_fixed"] else "⚠️ 未修复"
            error_section += f"### {e['tool']} — {e['error_type']}\n"
            error_section += f"- 出现次数：{e['count']}（严重程度：{e['severity']}）\n"
            error_section += f"- 状态：{status}\n"
            error_section += f"- 最新错误：`{e['latest_err']}`\n\n"
        new_sections.append(error_section)

    # 最佳实践
    if patterns:
        pattern_section = f"\n## 🟢 最佳实践（自动分析 {now_str}）\n\n"
        for p in patterns[:5]:
            pattern_section += f"### {p['tool']}\n"
            pattern_section += f"- 成功率：{p['success_rate']}%（{p['total_calls']}次调用）\n"
            pattern_section += f"- 平均延迟：{p['avg_latency_ms']}ms\n"
            pattern_section += f"- 建议：{p['recommendation']}\n\n"
        new_sections.append(pattern_section)

    # 技能建议
    if skill_suggestions:
        skill_section = f"\n## 💡 技能建议（自动分析 {now_str}）\n\n"
        for s in skill_suggestions[:5]:
            skill_section += f"### {s['name']}\n"
            skill_section += f"- 类型：{s['type']} | 频率：{s['frequency']}次\n"
            skill_section += f"- 描述：{s['description']}\n\n"
        new_sections.append(skill_section)

    # 合并（去重：移除旧的同名 section）
    if new_sections:
        # 确保是字符串
        sections_text = "\n".join(new_sections) if isinstance(new_sections, list) else new_sections
        final_learnings = _merge_learnings(existing_learnings, sections_text)
        learnings_path.parent.mkdir(parents=True, exist_ok=True)
        learnings_path.write_text(final_learnings, encoding="utf-8")

    # ---- 更新 MEMORY.md ----
    if preferences:
        pref_section = f"\n## 📊 用户偏好（自动分析 {now_str}）\n\n"
        for p in preferences:
            pref_section += f"- **{p['category']}**：{p['content']}\n"
        new_memory = _merge_memory(existing_memory, pref_section)
        memory_path.parent.mkdir(parents=True, exist_ok=True)
        memory_path.write_text(new_memory, encoding="utf-8")

    return {
        "errors_found": len(errors),
        "patterns_found": len(patterns),
        "preferences_found": len(preferences),
        "skills_suggested": len(skill_suggestions),
        "learnings_updated": bool(new_sections),
        "memory_updated": bool(preferences),
        "timestamp": now_str,
    }


def run_incremental_learning(tool_name: str, ok: bool, err: str = "") -> Optional[Dict[str, Any]]:
    """增量学习：每次工具调用后触发（轻量级）"""
    global _last_learn_ts

    import time
    now = time.time()
    if now - _last_learn_ts < _COOLDOWN:
        return None  # 冷却中

    _last_learn_ts = now

    # 只分析最近的错误
    if ok:
        return None

    records = eval_service._read_all_records()
    recent_errors = [r for r in records[-50:] if not r.get("ok") and r.get("tool") == tool_name]

    if len(recent_errors) < 2:
        return None  # 错误不够频繁，不记录

    # 同一工具连续出错 2 次以上 → 记录到 learnings.md
    hermes_home = get_hermes_home()
    learnings_path = hermes_home / "learnings.md"
    existing = learnings_path.read_text(encoding="utf-8", errors="replace") if learnings_path.exists() else ""

    err_type = _extract_error_type(err)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    # 检查是否已记录过相同错误
    if f"{tool_name} — {err_type}" in existing:
        return None  # 已记录过

    section = f"\n## 🔴 {tool_name} — {err_type}（自动检测 {now_str}）\n\n"
    section += f"- 出现次数：{len(recent_errors)}\n"
    section += f"- 最新错误：`{(err or '')[:200]}`\n"
    section += f"- 状态：⚠️ 未修复\n\n"

    final = _merge_learnings(existing, section)
    learnings_path.parent.mkdir(parents=True, exist_ok=True)
    learnings_path.write_text(final, encoding="utf-8")

    logger.info(f"自动学习：记录错误模式 {tool_name} — {err_type}")
    return {"recorded": True, "tool": tool_name, "error_type": err_type}


# ============================================================
# 辅助函数
# ============================================================

def _summarize_dict(d: Dict, max_len: int = 100) -> str:
    if not d:
        return ""
    parts = []
    for k, v in list(d.items())[:3]:
        sv = str(v)
        if len(sv) > 40:
            sv = sv[:40] + "..."
        parts.append(f"{k}={sv}")
    result = ", ".join(parts)
    return result[:max_len]


def _merge_learnings(existing: str, new_sections: str) -> str:
    """合并学习记录，移除旧的同名 section"""
    # 提取新 section 的标题
    new_titles = re.findall(r"^## (.+?)（自动", new_sections, re.MULTILINE)

    # 移除旧的同名 section
    lines = existing.split("\n")
    filtered = []
    skip = False
    for line in lines:
        if line.startswith("## ") and any(t in line for t in new_titles):
            skip = True
            continue
        if skip and line.startswith("## ") and not any(t in line for t in new_titles):
            skip = False
        if not skip:
            filtered.append(line)

    return "\n".join(filtered).rstrip() + "\n" + new_sections


def _merge_memory(existing: str, new_section: str) -> str:
    """合并记忆，替换旧的偏好 section"""
    marker = "## 📊 用户偏好"
    if marker in existing:
        # 移除旧 section
        lines = existing.split("\n")
        filtered = []
        skip = False
        for line in lines:
            if marker in line:
                skip = True
                continue
            if skip and line.startswith("## "):
                skip = False
            if not skip:
                filtered.append(line)
        return "\n".join(filtered).rstrip() + "\n" + new_section
    else:
        return existing.rstrip() + "\n" + new_section
