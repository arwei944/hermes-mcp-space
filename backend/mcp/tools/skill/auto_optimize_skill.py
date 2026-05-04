# -*- coding: utf-8 -*-
"""自动优化技能内容，基于质量评估结果进行改进"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="auto_optimize_skill",
        description="自动优化技能内容，基于质量评估结果进行改进",
        schema={
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "要优化的技能名称，或传入 'all' 优化所有技能",
                },
                "optimization_type": {
                    "type": "string",
                    "enum": ["content_improvement", "structure_fix", "full"],
                    "default": "full",
                    "description": "优化类型: content_improvement(内容改进), structure_fix(结构修复), full(全部)",
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "试运行模式，仅报告建议不实际修改",
                },
            },
            "required": ["skill_name"],
        },
        handler=handle,
        tags=["skill"],
    )


def _evaluate_quality(content: str, description: str, tags: list) -> dict:
    """评估技能内容质量 (0-100)"""
    import re

    score = 0
    issues = []

    if description and len(description.strip()) > 0:
        score += 10
    else:
        issues.append("missing_description")

    if tags and len(tags) > 0:
        score += 10
    else:
        issues.append("missing_tags")

    if len(content) > 200:
        score += 20
    else:
        issues.append("content_too_short")

    has_code_block = "```" in content
    has_example = any(kw in content.lower() for kw in ["example", "示例", "用例", "sample"])
    if has_code_block or has_example:
        score += 20
    else:
        issues.append("missing_examples")

    headers = re.findall(r'^##\s+.+', content, re.MULTILINE)
    if len(headers) >= 2:
        score += 20
    else:
        issues.append("poor_structure")

    instruction_keywords = ["步骤", "step", "操作", "执行", "指令", "instruction", "流程", "workflow"]
    has_instructions = any(kw in content.lower() for kw in instruction_keywords)
    if has_instructions:
        score += 20
    else:
        issues.append("missing_instructions")

    return {"score": min(score, 100), "issues": issues}


def _evaluate_completeness(content: str, category: str, version: str) -> dict:
    """评估技能完整度 (0-100)"""
    import re

    score = 0
    issues = []

    has_frontmatter = bool(re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL))
    if has_frontmatter:
        score += 25
    else:
        issues.append("missing_frontmatter")

    if category and len(category.strip()) > 0:
        score += 25
    else:
        issues.append("missing_category")

    if version and len(version.strip()) > 0:
        score += 25
    else:
        issues.append("missing_version")

    headers = re.findall(r'^##\s+.+', content, re.MULTILINE)
    if len(headers) >= 3:
        score += 25
    else:
        issues.append("insufficient_sections")

    return {"score": min(score, 100), "issues": issues}


def _apply_content_improvement(content: str, description: str, tags: list, issues: list) -> tuple:
    """应用内容改进，返回 (new_content, optimizations)"""
    import re

    optimizations = []
    new_content = content

    # 提取标题
    title_match = re.match(r'^#\s+(.+)', content)
    title = title_match.group(1).strip() if title_match else "技能"

    # 如果缺少描述，在标题后添加
    if "missing_description" in issues:
        desc_text = description if description else f"此技能用于 {title}"
        insert_text = f"\n\n> {desc_text}\n"
        if title_match:
            # 在标题后面插入
            end_of_title = title_match.end()
            new_content = new_content[:end_of_title] + insert_text + new_content[end_of_title:]
        optimizations.append({
            "type": "add_description",
            "before": "(无描述)",
            "after": desc_text[:80],
        })

    # 如果缺少示例，添加示例章节
    if "missing_examples" in issues:
        example_section = f"""

## 使用示例

```
# 示例: {title} 的基本用法
# 1. 确认前置条件
# 2. 执行主要操作
# 3. 验证结果
```
"""
        new_content += example_section
        optimizations.append({
            "type": "add_examples",
            "before": "(无示例)",
            "after": "已添加使用示例章节",
        })

    # 如果结构不佳，添加结构化章节
    if "poor_structure" in issues:
        # 检查是否已有描述和触发条件
        has_desc = "描述" in new_content or "description" in new_content.lower()
        has_trigger = "触发" in new_content or "trigger" in new_content.lower()
        has_steps = "步骤" in new_content or "step" in new_content.lower()

        structure_additions = []
        if not has_desc:
            structure_additions.append("## 描述\n\n简要描述此技能的用途和功能。\n")
        if not has_trigger:
            structure_additions.append("## 触发条件\n\n说明何时应激活此技能。\n")
        if not has_steps:
            structure_additions.append("## 执行步骤\n\n1. 第一步\n2. 第二步\n3. 第三步\n")

        if structure_additions:
            added = "\n".join(structure_additions)
            new_content += f"\n{added}"
            optimizations.append({
                "type": "add_structure",
                "before": f"结构化章节不足",
                "after": f"添加了 {len(structure_additions)} 个结构化章节",
            })

    # 如果缺少指令
    if "missing_instructions" in issues:
        if "执行步骤" not in new_content and "## 步骤" not in new_content:
            new_content += "\n## 执行步骤\n\n请按以下步骤操作：\n1. 确认环境和前置条件\n2. 执行核心功能\n3. 检查输出结果\n"
            optimizations.append({
                "type": "add_instructions",
                "before": "(无指令)",
                "after": "已添加执行步骤",
            })

    # 如果内容过短
    if "content_too_short" in issues and len(new_content) < 200:
        new_content += f"\n\n## 详细说明\n\n此技能 ({title}) 提供特定功能支持。\n请在实际使用中补充更详细的说明和操作指南。\n"
        optimizations.append({
            "type": "expand_content",
            "before": f"内容长度: {len(content)}",
            "after": f"内容长度: {len(new_content)}",
        })

    return new_content, optimizations


def _apply_structure_fix(content: str, category: str, version: str, tags: list, issues: list) -> tuple:
    """应用结构修复，返回 (new_content, new_tags, new_description, optimizations)"""
    import re

    optimizations = []
    new_tags = list(tags) if tags else []
    new_description = ""
    new_content = content

    # 提取标题
    title_match = re.match(r'^#\s+(.+)', content)
    title = title_match.group(1).strip() if title_match else "技能"

    # 添加 frontmatter
    if "missing_frontmatter" in issues:
        # 先移除已有的 frontmatter（如果有格式不对的）
        fm_match = re.match(r'^---\s*\n(.*?)\n---\s*\n?', content, re.DOTALL)
        if fm_match:
            body = content[fm_match.end():]
        else:
            body = content

        # 构建 frontmatter
        fm_lines = ["---"]
        if description := _extract_description(body):
            fm_lines.append(f'description: "{description}"')
            new_description = description
        else:
            new_description = f"技能: {title}"
            fm_lines.append(f'description: "{new_description}"')

        if category:
            fm_lines.append(f'category: "{category}"')
        else:
            fm_lines.append('category: "general"')

        if version:
            fm_lines.append(f'version: "{version}"')
        else:
            fm_lines.append('version: "1.0.0"')

        if new_tags:
            fm_lines.append('tags: [' + ', '.join(f'"{t}"' for t in new_tags) + ']')
        else:
            fm_lines.append('tags: ["auto-optimized"]')
            new_tags = ["auto-optimized"]

        fm_lines.append("---")
        frontmatter = "\n".join(fm_lines)
        new_content = frontmatter + "\n\n" + body

        optimizations.append({
            "type": "add_frontmatter",
            "before": "(无 frontmatter)",
            "after": f"添加了 frontmatter (description, category, version, tags)",
        })

    # 添加分类
    if "missing_category" in issues and "missing_frontmatter" not in issues:
        # frontmatter 已处理分类，这里处理无 frontmatter 的情况
        optimizations.append({
            "type": "add_category",
            "before": "(无分类)",
            "after": "general",
        })

    # 添加版本
    if "missing_version" in issues and "missing_frontmatter" not in issues:
        optimizations.append({
            "type": "add_version",
            "before": "(无版本)",
            "after": "1.0.0",
        })

    # 添加标签
    if not new_tags:
        new_tags = ["auto-optimized"]

    # 章节不足
    if "insufficient_sections" in issues:
        headers = re.findall(r'^##\s+.+', new_content, re.MULTILINE)
        missing = []
        if not any("注意" in h or "note" in h.lower() for h in headers):
            missing.append("## 注意事项\n\n使用此技能时请注意以下事项。\n")
        if not any("参考" in h or "reference" in h.lower() for h in headers):
            missing.append("## 参考资料\n\n相关参考文档和链接。\n")
        if missing:
            new_content += "\n" + "\n".join(missing)
            optimizations.append({
                "type": "add_sections",
                "before": f"章节数: {len(headers)}",
                "after": f"章节数: {len(headers) + len(missing)}",
            })

    return new_content, new_tags, new_description, optimizations


def _extract_description(content: str) -> str:
    """从内容中提取描述"""
    import re

    # 尝试从引用块提取
    quote_match = re.search(r'^>\s*(.+)', content, re.MULTILINE)
    if quote_match:
        desc = quote_match.group(1).strip()
        if len(desc) > 5:
            return desc[:100]

    # 尝试从描述章节提取
    desc_match = re.search(r'##\s*(?:描述|Description)\s*\n+(.*?)(?=\n##|\Z)', content, re.DOTALL)
    if desc_match:
        desc = desc_match.group(1).strip().split("\n")[0]
        if len(desc) > 5:
            return desc[:100]

    return ""


def handle(args: dict) -> dict:
    """自动优化技能"""
    from backend.services.skill_service import SkillService

    try:
        skill_name = args["skill_name"]
        optimization_type = args.get("optimization_type", "full")
        dry_run = args.get("dry_run", False)

        skill_svc = SkillService()

        # 确定要优化的技能列表
        if skill_name.lower() == "all":
            all_skills = skill_svc.list_skills()
            if not all_skills:
                return success_response(message="当前没有可用技能。")
            targets = [s["name"] for s in all_skills]
        else:
            detail = skill_svc.get_skill(skill_name)
            if not detail:
                return error_response(message=f"技能 '{skill_name}' 不存在")
            targets = [skill_name]

        all_results = []
        nl = "\n"

        for name in targets:
            detail = skill_svc.get_skill(name)
            if not detail:
                all_results.append({
                    "skill_name": name,
                    "status": "skipped",
                    "reason": "技能不存在或无法读取",
                })
                continue

            content = detail.get("content", "")
            if not content:
                all_results.append({
                    "skill_name": name,
                    "status": "skipped",
                    "reason": "技能内容为空",
                })
                continue

            # 获取元数据
            all_skills_list = skill_svc.list_skills()
            skill_meta = next((s for s in all_skills_list if s["name"] == name), {})
            description = skill_meta.get("description", "")
            tags = skill_meta.get("tags", [])
            category = skill_meta.get("category", "")
            version = skill_meta.get("version", "")

            # 评估当前质量
            quality = _evaluate_quality(content, description, tags)
            completeness = _evaluate_completeness(content, category, version)

            optimizations = []
            new_content = content
            new_tags = list(tags) if tags else []
            new_description = description

            # 根据优化类型应用改进
            if optimization_type in ("content_improvement", "full"):
                if quality["score"] < 60:
                    new_content, content_opts = _apply_content_improvement(
                        new_content, new_description, new_tags, quality["issues"]
                    )
                    optimizations.extend(content_opts)

            if optimization_type in ("structure_fix", "full"):
                if completeness["score"] < 50:
                    new_content, new_tags, new_description, struct_opts = _apply_structure_fix(
                        new_content, category, version, new_tags, completeness["issues"]
                    )
                    optimizations.extend(struct_opts)

            if not optimizations:
                all_results.append({
                    "skill_name": name,
                    "status": "no_optimization_needed",
                    "quality_score": quality["score"],
                    "completeness_score": completeness["score"],
                    "optimizations_applied": [],
                })
                continue

            # 计算新分数
            new_quality = _evaluate_quality(new_content, new_description, new_tags)
            new_completeness = _evaluate_completeness(new_content, category or "general", version or "1.0.0")

            if dry_run:
                # 试运行，不实际修改
                all_results.append({
                    "skill_name": name,
                    "status": "dry_run",
                    "quality_score": quality["score"],
                    "completeness_score": completeness["score"],
                    "new_quality_score": new_quality["score"],
                    "new_completeness_score": new_completeness["score"],
                    "optimizations_applied": optimizations,
                })
            else:
                # 实际应用优化
                update_result = skill_svc.update_skill(
                    name=name,
                    content=new_content,
                    description=new_description,
                    tags=new_tags,
                )
                if update_result.get("success"):
                    all_results.append({
                        "skill_name": name,
                        "status": "optimized",
                        "quality_score": quality["score"],
                        "completeness_score": completeness["score"],
                        "new_quality_score": new_quality["score"],
                        "new_completeness_score": new_completeness["score"],
                        "optimizations_applied": optimizations,
                    })
                else:
                    all_results.append({
                        "skill_name": name,
                        "status": "update_failed",
                        "reason": update_result.get("message", "更新失败"),
                        "optimizations_applied": optimizations,
                    })

        # 构建输出消息
        optimized_count = sum(1 for r in all_results if r["status"] in ("optimized", "dry_run"))
        skipped_count = sum(1 for r in all_results if r["status"] in ("skipped", "no_optimization_needed"))

        msg_lines = [
            f"技能优化完成 ({'试运行' if dry_run else '正式执行'})",
            f"优化类型: {optimization_type}",
            f"处理技能: {len(targets)} 个",
            f"{'='*50}",
        ]

        for r in all_results:
            name = r["skill_name"]
            status = r["status"]
            if status == "optimized":
                msg_lines.append(f"  [已优化] {name}")
                msg_lines.append(f"    质量: {r['quality_score']} -> {r['new_quality_score']} | 完整度: {r['completeness_score']} -> {r['new_completeness_score']}")
            elif status == "dry_run":
                msg_lines.append(f"  [试运行] {name}")
                msg_lines.append(f"    质量: {r['quality_score']} -> {r['new_quality_score']} | 完整度: {r['completeness_score']} -> {r['new_completeness_score']}")
            elif status == "no_optimization_needed":
                msg_lines.append(f"  [无需优化] {name} (质量: {r['quality_score']}, 完整度: {r['completeness_score']})")
            elif status == "skipped":
                msg_lines.append(f"  [跳过] {name}: {r.get('reason', '')}")
            elif status == "update_failed":
                msg_lines.append(f"  [失败] {name}: {r.get('reason', '')}")

            if r.get("optimizations_applied"):
                for opt in r["optimizations_applied"]:
                    msg_lines.append(f"    - {opt['type']}: {opt.get('after', '')}")

        if dry_run and optimized_count > 0:
            msg_lines.append(f"\n提示: 当前为试运行模式，设置 dry_run=false 可实际应用优化。")

        return success_response(
            data={
                "results": all_results,
                "optimization_type": optimization_type,
                "dry_run": dry_run,
                "total_processed": len(targets),
                "optimized": optimized_count,
                "skipped": skipped_count,
            },
            message=nl.join(msg_lines),
        )
    except Exception as e:
        return error_response(message=f"技能优化失败: {e}", code="OPTIMIZE_ERROR")
