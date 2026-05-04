# -*- coding: utf-8 -*-
"""双盲评审 — 两个 Judge Agent 并行审查，共识表裁决

流程:
1. 提交内容给评审
2. Judge A 和 Judge B 并行审查（互不知道对方）
3. 生成共识表（FIX / TRIAGE / DISMISS）
4. FIX 项自动修复后可重新评审（最多 2 轮）

裁决规则:
| 裁决     | 条件                                    |
|----------|----------------------------------------|
| FIX      | 2+ 个 Agent 发现，或任何单个 CRITICAL  |
| TRIAGE   | 仅 1 个 Agent 发现（非严重）            |
| DISMISS  | 被其他 Agent 反驳 + 仅 SUGGESTION      |
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.mcp.tools._base import register_tool, success_response, error_response

logger = logging.getLogger("hermes-mcp")

# 严重等级
SEVERITY_LEVELS = {
    "critical": 4,  # 必须修复
    "major": 3,     # 强烈建议修复
    "minor": 2,     # 建议修复
    "suggestion": 1,  # 可选改进
}

# 评审维度
REVIEW_DIMENSIONS = [
    {"name": "功能正确性", "description": "实现是否满足需求，逻辑是否正确"},
    {"name": "错误处理", "description": "异常情况是否被妥善处理"},
    {"name": "代码质量", "description": "可读性、可维护性、命名规范"},
    {"name": "安全性", "description": "是否存在安全风险（注入、泄露等）"},
    {"name": "性能", "description": "是否存在明显的性能问题"},
]


def register(reg):
    register_tool(
        reg,
        name="dual_review",
        description="双盲评审 — 两个 Judge Agent 并行审查，共识表裁决。提交内容后自动生成评审报告。",
        schema={
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "待评审的内容（代码、文档、配置等）",
                },
                "content_type": {
                    "type": "string",
                    "default": "code",
                    "enum": ["code", "document", "config", "general"],
                    "description": "内容类型",
                },
                "title": {
                    "type": "string",
                    "description": "评审标题",
                },
                "context": {
                    "type": "string",
                    "description": "额外上下文（需求描述、约束条件等）",
                },
                "judge_a_findings": {
                    "type": "string",
                    "description": "Judge A 的发现（JSON 格式，用于提交评审结果）",
                },
                "judge_b_findings": {
                    "type": "string",
                    "description": "Judge B 的发现（JSON 格式，用于提交评审结果）",
                },
                "review_id": {
                    "type": "string",
                    "description": "已有评审 ID（用于重新评审）",
                },
                "round": {
                    "type": "integer",
                    "default": 1,
                    "description": "评审轮次（最多 2 轮）",
                },
            },
            "required": ["content"],
        },
        handler=handle,
        tags=["knowledge"],
    )


def handle(args: dict) -> dict:
    content = args.get("content", "")
    title = args.get("title", "")
    content_type = args.get("content_type", "code")
    context = args.get("context", "")
    judge_a_str = args.get("judge_a_findings", "")
    judge_b_str = args.get("judge_b_findings", "")
    review_id = args.get("review_id", "")
    round_num = args.get("round", 1)

    if not content:
        return error_response("请提供待评审的内容")

    try:
        # 如果提供了两个 Judge 的结果，直接生成共识表
        if judge_a_str and judge_b_str:
            return _generate_verdict(
                title, content, content_type, context,
                judge_a_str, judge_b_str, review_id, round_num,
            )

        # 否则生成评审模板，指导两个 Judge 进行评审
        return _generate_review_template(
            title, content, content_type, context, review_id, round_num,
        )
    except Exception as e:
        logger.error(f"dual_review error: {e}")
        return error_response(str(e))


def _generate_review_template(
    title: str, content: str, content_type: str,
    context: str, review_id: str, round_num: int,
) -> dict:
    """生成评审模板 — 指导两个 Judge 并行审查"""
    rid = review_id or f"dr_{uuid.uuid4().hex[:8]}"

    # 截断过长内容用于展示
    content_preview = content[:2000] + ("..." if len(content) > 2000 else "")

    judge_prompt = f"""## 双盲评审 — Judge 模板

### 评审 ID: {rid}
### 轮次: {round_num}/2
### 标题: {title or '（未命名）'}
### 类型: {content_type}

### 待评审内容
```
{content_preview}
```

### 上下文
{context or '（无额外上下文）'}

---

## 🔒 Judge A — 独立评审

请仔细审查上述内容，按以下格式输出发现：

```json
{{
  "judge": "A",
  "findings": [
    {{
      "id": "A1",
      "dimension": "功能正确性/错误处理/代码质量/安全性/性能",
      "severity": "critical/major/minor/suggestion",
      "location": "具体位置（行号/段落）",
      "description": "问题描述",
      "suggestion": "修复建议"
    }}
  ],
  "overall_score": 1-10,
  "summary": "总体评价"
}}
```

## 🔒 Judge B — 独立评审

（同上格式，但 Judge B 不知道 Judge A 的结果）

```json
{{
  "judge": "B",
  "findings": [...],
  "overall_score": 1-10,
  "summary": "总体评价"
}}
```

---

### 操作说明
1. 让两个不同的 Agent/会话分别担任 Judge A 和 Judge B
2. 各自独立审查，不交流
3. 收集两个 Judge 的 JSON 结果后，使用 dual_review 提交：
   - judge_a_findings=<Judge A 的 JSON>
   - judge_b_findings=<Judge B 的 JSON>
   - review_id={rid}
4. 系统将自动生成共识表和裁决

### 评审维度
{chr(10).join(f'- **{d["name"]}**: {d["description"]}' for d in REVIEW_DIMENSIONS)}"""

    return success_response(
        data={
            "review_id": rid,
            "phase": "reviewing",
            "round": round_num,
            "content_type": content_type,
            "dimensions": REVIEW_DIMENSIONS,
        },
        message=judge_prompt,
    )


def _generate_verdict(
    title: str, content: str, content_type: str, context: str,
    judge_a_str: str, judge_b_str: str, review_id: str, round_num: int,
) -> dict:
    """生成共识表和裁决"""
    try:
        findings_a = json.loads(judge_a_str) if isinstance(judge_a_str, str) else judge_a_str
        findings_b = json.loads(judge_b_str) if isinstance(judge_b_str, str) else judge_b_str
    except json.JSONDecodeError as e:
        return error_response(f"Judge 结果 JSON 解析失败: {e}")

    items_a = findings_a.get("findings", [])
    items_b = findings_b.get("findings", [])
    score_a = findings_a.get("overall_score", 5)
    score_b = findings_b.get("overall_score", 5)

    # 构建共识表
    consensus = _build_consensus_table(items_a, items_b)

    # 生成裁决
    verdict_items = []
    for item in consensus:
        item_verdict = _determine_verdict(item)
        verdict_items.append({**item, "verdict": item_verdict})

    # 统计裁决
    fix_count = sum(1 for v in verdict_items if v["verdict"] == "FIX")
    triage_count = sum(1 for v in verdict_items if v["verdict"] == "TRIAGE")
    dismiss_count = sum(1 for v in verdict_items if v["verdict"] == "DISMISS")

    # 总体裁决
    if fix_count > 0:
        overall = "NEEDS_FIX"
        overall_msg = f"需要修复 {fix_count} 项后重新评审"
    elif triage_count > 0:
        overall = "ACCEPTABLE"
        overall_msg = f"可接受，{triage_count} 项建议后续优化"
    else:
        overall = "APPROVED"
        overall_msg = "评审通过，所有发现已被驳回或为建议级别"

    # 是否需要重新评审
    needs_re_review = fix_count > 0 and round_num < 2

    now = datetime.now().isoformat()
    rid = review_id or f"dr_{uuid.uuid4().hex[:8]}"

    # 记录评审结果
    try:
        from backend.services.hermes_service import hermes_service
        hermes_service.add_session_message(
            session_id="solo_realtime",
            role="assistant",
            content=f"[dual_review] 评审 {rid} 完成: {overall} (FIX={fix_count}, TRIAGE={triage_count}, DISMISS={dismiss_count})",
            metadata={
                "review_id": rid,
                "verdict": overall,
                "round": round_num,
                "score_a": score_a,
                "score_b": score_b,
            },
        )
    except Exception:
        pass

    # 生成报告
    nl = "\n"
    report = f"""# 🔍 双盲评审报告

## 基本信息
- **评审 ID**: {rid}
- **标题**: {title or '（未命名）'}
- **类型**: {content_type}
- **轮次**: {round_num}/2
- **时间**: {now}

## 评分
| Judge | 评分 |
|-------|------|
| Judge A | {score_a}/10 |
| Judge B | {score_b}/10 |
| **平均** | **{(score_a + score_b) / 2:.1f}/10** |

## 共识表

| # | 维度 | 严重等级 | 发现者 | 裁决 | 描述 |
|---|------|---------|--------|------|------|
{nl.join(f"| {i+1} | {v['dimension']} | {v['severity']} | {v['found_by']} | **{v['verdict']}** | {v['description'][:60]}..." for i, v in enumerate(verdict_items))}

## 裁决统计
- 🔴 FIX: {fix_count}
- 🟡 TRIAGE: {triage_count}
- 🟢 DISMISS: {dismiss_count}

## 总体裁决: **{overall}**
{overall_msg}

{f"### 下一步\n请修复 FIX 项后使用 dual_review 重新评审（round={round_num + 1}）。" if needs_re_review else "### ✅ 评审流程结束"}"""

    return success_response(
        data={
            "review_id": rid,
            "verdict": overall,
            "verdict_message": overall_msg,
            "round": round_num,
            "needs_re_review": needs_re_review,
            "scores": {"judge_a": score_a, "judge_b": score_b, "average": (score_a + score_b) / 2},
            "consensus": verdict_items,
            "statistics": {
                "fix": fix_count,
                "triage": triage_count,
                "dismiss": dismiss_count,
                "total_findings": len(verdict_items),
            },
        },
        message=report,
    )


def _build_consensus_table(
    items_a: List[dict], items_b: List[dict]
) -> List[dict]:
    """构建共识表 — 匹配两个 Judge 的发现"""
    consensus = []
    seen_descriptions = set()

    # 处理 Judge A 的发现
    for item in items_a:
        desc_key = item.get("description", "")[:50].lower()
        matched = False

        # 尝试与 Judge B 的发现匹配
        for b_item in items_b:
            b_desc_key = b_item.get("description", "")[:50].lower()
            if desc_key == b_desc_key or _similar(desc_key, b_desc_key):
                # 两个 Judge 都发现了
                consensus.append({
                    "dimension": item.get("dimension", "未知"),
                    "severity": _max_severity(
                        item.get("severity", "minor"),
                        b_item.get("severity", "minor"),
                    ),
                    "found_by": "A+B",
                    "description": item.get("description", ""),
                    "suggestion_a": item.get("suggestion", ""),
                    "suggestion_b": b_item.get("suggestion", ""),
                    "location": item.get("location", ""),
                })
                seen_descriptions.add(b_desc_key)
                matched = True
                break

        if not matched:
            consensus.append({
                "dimension": item.get("dimension", "未知"),
                "severity": item.get("severity", "minor"),
                "found_by": "A",
                "description": item.get("description", ""),
                "suggestion_a": item.get("suggestion", ""),
                "suggestion_b": "",
                "location": item.get("location", ""),
            })
        seen_descriptions.add(desc_key)

    # 处理 Judge B 独有的发现
    for item in items_b:
        desc_key = item.get("description", "")[:50].lower()
        if desc_key not in seen_descriptions:
            consensus.append({
                "dimension": item.get("dimension", "未知"),
                "severity": item.get("severity", "minor"),
                "found_by": "B",
                "description": item.get("description", ""),
                "suggestion_a": "",
                "suggestion_b": item.get("suggestion", ""),
                "location": item.get("location", ""),
            })

    # 按严重等级排序
    consensus.sort(key=lambda x: SEVERITY_LEVELS.get(x.get("severity", "minor"), 2), reverse=True)
    return consensus


def _determine_verdict(item: dict) -> str:
    """根据共识表规则确定裁决"""
    found_by = item.get("found_by", "")
    severity = item.get("severity", "minor")

    # FIX: 2+ 个 Agent 发现，或任何 CRITICAL
    if found_by == "A+B" or severity == "critical":
        return "FIX"

    # TRIAGE: 仅 1 个 Agent 发现（非严重）
    if severity in ("major", "minor"):
        return "TRIAGE"

    # DISMISS: 仅 SUGGESTION 级别
    return "DISMISS"


def _max_severity(sev_a: str, sev_b: str) -> str:
    """取两个严重等级中更高的"""
    level_a = SEVERITY_LEVELS.get(sev_a, 2)
    level_b = SEVERITY_LEVELS.get(sev_b, 2)
    if level_a >= level_b:
        return sev_a
    return sev_b


def _similar(a: str, b: str) -> bool:
    """简单的相似度判断（共享关键词）"""
    words_a = set(a.split())
    words_b = set(b.split())
    if not words_a or not words_b:
        return False
    common = words_a & words_b
    return len(common) / max(len(words_a), len(words_b)) > 0.5
