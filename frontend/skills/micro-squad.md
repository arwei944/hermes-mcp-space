---
name: micro-squad
description: 标准化 Sprint 工作流技能（THINK→PLAN→BUILD→VERIFY→SHIP）
tags: [workflow, agent, squad]
requires_toolsets: [skills]
---

# micro-squad — 微型团队工作流

## 概述
使用专职分工模式完成复杂任务，每个阶段由不同"角色"审查。

## 工作流命令

### /squad <task>
完整 Sprint 流程：THINK → PLAN → BUILD → VERIFY → SHIP

### /think
强制质疑假设，挑战需求中的隐含前提：
1. 列出所有假设
2. 对每个假设提出反面论据
3. 标记需要用户确认的关键决策

### /plan
并行规划阶段：
1. 分解任务为最小可验证子任务
2. 评估每个子任务的依赖关系
3. 估算工作量，标记风险点
4. 生成执行计划

### /build
带约束的实现阶段：
1. 按计划逐步实现
2. 每步完成后自检
3. 遇到偏差时记录并调整
4. 保持代码质量（错误处理、边界情况）

### /verify
双盲评审阶段：
1. 以"挑剔用户"视角审查交付物
2. 检查边界情况和错误处理
3. 验证是否满足原始需求
4. 生成评审报告（PASS / NEEDS_FIX / FAIL）

### /ship
带证据链的提交：
1. 汇总所有变更
2. 生成变更摘要
3. 列出测试结果
4. 提交并推送

## 使用建议
- 简单任务直接 BUILD
- 中等任务 PLAN → BUILD → VERIFY
- 复杂任务使用完整 /squad
- 关键任务增加 VERIFY 轮次
