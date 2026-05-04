# -*- coding: utf-8 -*-
"""micro-squad 标准化 Sprint 工作流

支持命令:
  /squad <task>  — 完整 Sprint（THINK→PLAN→BUILD→VERIFY→SHIP）
  /think         — 强制提问挑战假设
  /plan          — 并行规划
  /build         — 带约束的实现
  /verify        — 双盲评审 + QA
  /ship          — 带完整证据链的提交

基于 delegate_task 实现子 Agent 并行工作，
通过 review pipeline 实现质量门控。
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.mcp.tools._base import register_tool, success_response, error_response

logger = logging.getLogger("hermes-mcp")

# Sprint 阶段定义
SPRINT_PHASES = {
    "think": {
        "label": "THINK - 挑战假设",
        "description": "对任务需求进行批判性分析，识别隐含假设和潜在风险",
        "prompts": [
            "这个任务的核心目标是什么？有没有更简单的方式实现？",
            "用户可能遗漏了什么需求？",
            "有哪些隐含的约束条件？",
            "最可能失败的地方在哪里？",
        ],
    },
    "plan": {
        "label": "PLAN - 并行规划",
        "description": "将任务分解为可并行执行的子任务，制定执行计划",
        "output": "结构化执行计划（子任务列表 + 依赖关系 + 预估时间）",
    },
    "build": {
        "label": "BUILD - 带约束的实现",
        "description": "按照计划执行实现，遵守预设约束",
        "constraints": [
            "每个子任务独立可验证",
            "代码变更不超过 200 行/子任务",
            "必须包含错误处理",
        ],
    },
    "verify": {
        "label": "VERIFY - 双盲评审 + QA",
        "description": "通过双盲评审验证实现质量",
        "criteria": ["功能正确性", "错误处理完整性", "代码可读性", "安全性"],
    },
    "ship": {
        "label": "SHIP - 带证据链的提交",
        "description": "生成完整的提交记录和变更说明",
        "artifacts": ["commit message", "changelog entry", "test report"],
    },
}


def register(reg):
    register_tool(
        reg,
        name="micro_squad",
        description="micro-squad 标准化 Sprint 工作流。支持完整 Sprint 或单阶段执行。command: squad/think/plan/build/verify/ship",
        schema={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["squad", "think", "plan", "build", "verify", "ship"],
                    "description": "Sprint 命令",
                },
                "task": {
                    "type": "string",
                    "description": "任务描述（squad 命令必填，其他可选）",
                },
                "context": {
                    "type": "string",
                    "description": "上下文信息（相关文件、约束条件等）",
                },
                "session_id": {
                    "type": "string",
                    "description": "关联的会话 ID",
                },
                "sub_tasks": {
                    "type": "string",
                    "description": "子任务 JSON 数组（plan/build 阶段使用）",
                },
                "review_results": {
                    "type": "string",
                    "description": "评审结果 JSON（ship 阶段使用）",
                },
            },
            "required": ["command"],
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    command = args.get("command", "squad")
    task = args.get("task", "")
    context = args.get("context", "")
    session_id = args.get("session_id", "")

    try:
        if command == "squad":
            return _handle_squad(task, context, session_id)
        elif command == "think":
            return _handle_think(task, context)
        elif command == "plan":
            return _handle_plan(task, context, session_id)
        elif command == "build":
            return _handle_build(task, args.get("sub_tasks", ""), session_id)
        elif command == "verify":
            return _handle_verify(task, session_id)
        elif command == "ship":
            return _handle_ship(task, args.get("review_results", ""), session_id)
        else:
            return error_response(f"未知命令: {command}")
    except Exception as e:
        logger.error(f"micro_squad error: {e}")
        return error_response(str(e))


def _handle_squad(task: str, context: str, session_id: str) -> dict:
    """完整 Sprint — 生成所有阶段的指导"""
    if not task:
        return error_response("squad 命令需要提供 task 参数")

    sprint_id = f"squad_{uuid.uuid4().hex[:8]}"
    now = datetime.now().isoformat()

    # 生成完整 Sprint 指导
    phases = []
    for phase_key, phase_info in SPRINT_PHASES.items():
        phase_guide = {
            "phase": phase_key,
            "label": phase_info["label"],
            "description": phase_info["description"],
        }
        if phase_key == "think":
            phase_guide["questions"] = phase_info["prompts"]
        elif phase_key == "build":
            phase_guide["constraints"] = phase_info["constraints"]
        elif phase_key == "verify":
            phase_guide["criteria"] = phase_info["criteria"]
        elif phase_key == "ship":
            phase_guide["artifacts"] = phase_info["artifacts"]
        phases.append(phase_guide)

    # 记录 Sprint 开始
    try:
        from backend.services.hermes_service import hermes_service
        hermes_service.add_session_message(
            session_id=session_id or "solo_realtime",
            role="assistant",
            content=f"[micro-squad] Sprint {sprint_id} 开始: {task}",
            metadata={"sprint_id": sprint_id, "command": "squad", "task": task},
        )
    except Exception:
        pass

    guide = f"""# 🚀 micro-squad Sprint: {sprint_id}

## 任务
{task}

## 上下文
{context or '（无额外上下文）'}

## Sprint 阶段

### 1️⃣ THINK — 挑战假设
请依次回答以下问题：
{chr(10).join(f'- {q}' for q in SPRINT_PHASES['think']['prompts'])}

### 2️⃣ PLAN — 并行规划
将任务分解为可并行执行的子任务，使用 micro_squad command=plan 提交计划。

### 3️⃣ BUILD — 带约束的实现
按照计划执行，遵守以下约束：
{chr(10).join(f'- {c}' for c in SPRINT_PHASES['build']['constraints'])}

### 4️⃣ VERIFY — 双盲评审 + QA
使用 dual_review 工具进行双盲评审，检查维度：
{chr(10).join(f'- {c}' for c in SPRINT_PHASES['verify']['criteria'])}

### 5️⃣ SHIP — 带证据链的提交
生成以下交付物：
{chr(10).join(f'- {a}' for a in SPRINT_PHASES['ship']['artifacts'])}

---
使用 micro_squad command=<phase> 逐步执行各阶段。"""

    return success_response(
        data={
            "sprint_id": sprint_id,
            "task": task,
            "phases": phases,
            "status": "think",
            "created_at": now,
        },
        message=guide,
    )


def _handle_think(task: str, context: str) -> dict:
    """THINK 阶段 — 挑战假设"""
    questions = SPRINT_PHASES["think"]["prompts"]
    think_prompt = f"""## THINK 阶段 — 挑战假设

### 任务
{task or '（请先指定任务）'}

### 上下文
{context or '（无额外上下文）'}

### 请回答以下问题
{chr(10).join(f'**Q{i+1}**: {q}' for i, q in enumerate(questions))}

### 输出格式
请对每个问题给出简洁回答，最后总结：
- 核心假设列表
- 风险点列表
- 建议调整"""

    return success_response(
        data={
            "phase": "think",
            "questions": questions,
            "task": task,
        },
        message=think_prompt,
    )


def _handle_plan(task: str, context: str, session_id: str) -> dict:
    """PLAN 阶段 — 生成并行规划模板"""
    plan_template = f"""## PLAN 阶段 — 并行规划

### 任务
{task or '（请先指定任务）'}

### 上下文
{context or '（无额外上下文）'}

### 请输出结构化计划

```json
{{
  "sub_tasks": [
    {{
      "id": "T1",
      "title": "子任务标题",
      "description": "详细描述",
      "depends_on": [],
      "estimated_complexity": "low/medium/high",
      "tools_needed": ["工具1", "工具2"],
      "acceptance_criteria": "验收标准",
      "can_parallel": true
    }}
  ],
  "execution_order": ["T1", "T2", "T3"],
  "parallel_groups": [["T1", "T2"], ["T3"]],
  "risks": ["风险1", "风险2"],
  "estimated_total_steps": 5
}}
```

使用 micro_squad command=build sub_tasks=<上述JSON> 开始实现。"""

    return success_response(
        data={
            "phase": "plan",
            "task": task,
            "template": plan_template,
        },
        message=plan_template,
    )


def _handle_build(task: str, sub_tasks_str: str, session_id: str) -> dict:
    """BUILD 阶段 — 带约束的实现"""
    constraints = SPRINT_PHASES["build"]["constraints"]

    try:
        sub_tasks = json.loads(sub_tasks_str) if sub_tasks_str else []
    except json.JSONDecodeError:
        sub_tasks = []

    build_guide = f"""## BUILD 阶段 — 带约束的实现

### 任务
{task or '（请先指定任务）'}

### 子任务 ({len(sub_tasks)} 个)
{json.dumps(sub_tasks, ensure_ascii=False, indent=2) if sub_tasks else '（未提供子任务，请使用 command=plan 先规划）'}

### 约束条件
{chr(10).join(f'- ✅ {c}' for c in constraints)}

### 执行建议
1. 按并行组执行可并行的子任务
2. 每完成一个子任务立即验证
3. 遇到阻塞及时记录并调整计划
4. 完成后使用 micro_squad command=verify 进入评审"""

    return success_response(
        data={
            "phase": "build",
            "task": task,
            "sub_tasks": sub_tasks,
            "constraints": constraints,
        },
        message=build_guide,
    )


def _handle_verify(task: str, session_id: str) -> dict:
    """VERIFY 阶段 — 触发双盲评审"""
    criteria = SPRINT_PHASES["verify"]["criteria"]

    verify_guide = f"""## VERIFY 阶段 — 双盲评审 + QA

### 任务
{task or '（请先指定任务）'}

### 评审维度
{chr(10).join(f'- 🔍 {c}' for c in criteria)}

### 操作
请使用 dual_review 工具进行双盲评审：
- 提交本次 Sprint 的实现内容
- 两个 Judge Agent 将并行审查
- 根据共识表裁决结果决定是否通过

### 裁决规则
| 裁决 | 条件 |
|------|------|
| FIX | 2+ 个 Agent 发现，或任何 CRITICAL |
| TRIAGE | 仅 1 个 Agent 发现（非严重） |
| DISMISS | 被反驳 + 仅 SUGGESTION |

评审通过后使用 micro_squad command=ship 进入发布。"""

    return success_response(
        data={
            "phase": "verify",
            "task": task,
            "criteria": criteria,
        },
        message=verify_guide,
    )


def _handle_ship(task: str, review_results_str: str, session_id: str) -> dict:
    """SHIP 阶段 — 带证据链的提交"""
    artifacts = SPRINT_PHASES["ship"]["artifacts"]
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    try:
        review_results = json.loads(review_results_str) if review_results_str else {}
    except json.JSONDecodeError:
        review_results = {}

    ship_guide = f"""## SHIP 阶段 — 带证据链的提交

### 任务
{task or '（请先指定任务）'}

### 评审结果
{json.dumps(review_results, ensure_ascii=False, indent=2) if review_results else '（未提供评审结果）'}

### 交付物清单
{chr(10).join(f'- 📦 {a}' for a in artifacts)}

### 提交时间
{now}

### 操作
1. 生成规范的 commit message
2. 更新 changelog
3. 确认所有子任务验收通过
4. 提交并推送"""

    # 记录 Sprint 完成
    try:
        from backend.services.hermes_service import hermes_service
        hermes_service.add_session_message(
            session_id=session_id or "solo_realtime",
            role="assistant",
            content=f"[micro-squad] Sprint SHIP 完成: {task}",
            metadata={"command": "ship", "task": task, "review_results": review_results},
        )
    except Exception:
        pass

    return success_response(
        data={
            "phase": "ship",
            "task": task,
            "artifacts": artifacts,
            "review_results": review_results,
            "shipped_at": now,
        },
        message=ship_guide,
    )
