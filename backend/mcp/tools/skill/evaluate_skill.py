# -*- coding: utf-8 -*-
"""评估技能质量，基于内容分析和使用数据给出评分与建议"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="evaluate_skill",
        description="评估技能质量，基于内容分析和使用数据给出评分与建议",
        schema={
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "技能名称，或传入 'all' 评估所有技能",
                },
                "metrics": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["quality_score", "completeness", "usage_hint"]},
                    "description": "评估指标，默认全部",
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "试运行模式，不影响任何数据",
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
    details = []

    # 有描述 (+10)
    if description and len(description.strip()) > 0:
        score += 10
        details.append("有描述 (+10)")
    else:
        details.append("缺少描述 (+0)")

    # 有标签 (+10)
    if tags and len(tags) > 0:
        score += 10
        details.append("有标签 (+10)")
    else:
        details.append("缺少标签 (+0)")

    # 内容长度 > 200 字符 (+20)
    if len(content) > 200:
        score += 20
        details.append(f"内容长度充足 ({len(content)}字符, +20)")
    else:
        details.append(f"内容过短 ({len(content)}字符, +0)")

    # 有示例或代码块 (+20)
    has_code_block = "```" in content
    has_example = any(kw in content.lower() for kw in ["example", "示例", "用例", "sample"])
    if has_code_block or has_example:
        score += 20
        hints = []
        if has_code_block:
            hints.append("代码块")
        if has_example:
            hints.append("示例")
        details.append(f"含{'、'.join(hints)} (+20)")
    else:
        details.append("缺少示例或代码块 (+0)")

    # 有结构化章节 (## headers) (+20)
    headers = re.findall(r'^##\s+.+', content, re.MULTILINE)
    if len(headers) >= 2:
        score += 20
        details.append(f"有结构化章节 ({len(headers)}个, +20)")
    else:
        details.append(f"结构化章节不足 ({len(headers)}个, +0)")

    # 有清晰指令 (+20)
    instruction_keywords = ["步骤", "step", "操作", "执行", "指令", "instruction", "流程", "workflow"]
    has_instructions = any(kw in content.lower() for kw in instruction_keywords)
    if has_instructions:
        score += 20
        details.append("有清晰指令 (+20)")
    else:
        details.append("缺少清晰指令 (+0)")

    return {"score": min(score, 100), "details": details}


def _evaluate_completeness(content: str, category: str, version: str) -> dict:
    """评估技能完整度 (0-100)"""
    import re

    score = 0
    details = []

    # 有 frontmatter 元数据 (+25)
    has_frontmatter = bool(re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL))
    if has_frontmatter:
        score += 25
        details.append("有 frontmatter 元数据 (+25)")
    else:
        details.append("缺少 frontmatter 元数据 (+0)")

    # 有分类 (+25)
    if category and len(category.strip()) > 0:
        score += 25
        details.append(f"有分类 '{category}' (+25)")
    else:
        details.append("缺少分类 (+0)")

    # 有版本 (+25)
    if version and len(version.strip()) > 0:
        score += 25
        details.append(f"有版本 '{version}' (+25)")
    else:
        details.append("缺少版本 (+0)")

    # 有多个章节 (+25)
    headers = re.findall(r'^##\s+.+', content, re.MULTILINE)
    if len(headers) >= 3:
        score += 25
        details.append(f"有多个章节 ({len(headers)}个, +25)")
    else:
        details.append(f"章节不足 ({len(headers)}个, +0)")

    return {"score": min(score, 100), "details": details}


def _evaluate_usage_hint(skill_name: str, sessions: list) -> dict:
    """检查技能名称在最近会话消息中的出现情况"""
    if not sessions:
        return {"score": 0, "details": ["无会话数据"], "mentions": 0}

    from backend.services.session_service import SessionService
    session_svc = SessionService()

    mentions = 0
    checked_sessions = 0
    # 只检查最近 10 个会话
    for session in sessions[:10]:
        sid = session.get("id", "")
        if not sid:
            continue
        try:
            messages = session_svc.get_session_messages(sid)
            checked_sessions += 1
            for msg in messages:
                content = msg.get("content", "")
                if skill_name.lower() in content.lower():
                    mentions += 1
        except Exception:
            continue

    details = [f"检查了 {checked_sessions} 个会话，发现 {mentions} 次提及"]

    if mentions >= 5:
        score = 100
        details.append("使用频繁 (+100)")
    elif mentions >= 3:
        score = 75
        details.append("使用较频繁 (+75)")
    elif mentions >= 1:
        score = 50
        details.append("有少量使用 (+50)")
    else:
        score = 0
        details.append("未发现使用记录 (+0)")

    return {"score": score, "details": details, "mentions": mentions}


def _compute_grade(quality: int, completeness: int, usage: int) -> str:
    """根据三项分数计算综合等级"""
    avg = (quality + completeness + usage) / 3
    if avg >= 85:
        return "A"
    elif avg >= 70:
        return "B"
    elif avg >= 55:
        return "C"
    elif avg >= 40:
        return "D"
    else:
        return "F"


def _generate_suggestions(quality: dict, completeness: dict, usage: dict, skill_name: str) -> list:
    """根据评分生成改进建议"""
    suggestions = []

    if quality["score"] < 60:
        if "缺少描述" in str(quality["details"]):
            suggestions.append("添加技能描述，简要说明技能用途")
        if "缺少示例或代码块" in str(quality["details"]):
            suggestions.append("添加使用示例或代码块，提高可操作性")
        if "结构化章节不足" in str(quality["details"]):
            suggestions.append("增加 ## 章节标题，改善内容结构")
        if "缺少清晰指令" in str(quality["details"]):
            suggestions.append("添加明确的操作步骤或指令说明")
        if "内容过短" in str(quality["details"]):
            suggestions.append("扩充技能内容，使其更加详尽")

    if completeness["score"] < 50:
        if "缺少 frontmatter" in str(completeness["details"]):
            suggestions.append("添加 YAML frontmatter 元数据（description, tags, category, version）")
        if "缺少分类" in str(completeness["details"]):
            suggestions.append("设置技能分类（category）")
        if "缺少版本" in str(completeness["details"]):
            suggestions.append("设置技能版本号（version）")
        if "章节不足" in str(completeness["details"]):
            suggestions.append("增加更多内容章节")

    if usage["score"] == 0:
        suggestions.append("技能未被使用过，考虑是否需要推广或优化触发条件")

    if not suggestions:
        suggestions.append("技能质量良好，继续保持")

    return suggestions


def handle(args: dict) -> dict:
    """评估技能质量"""
    from backend.services.skill_service import SkillService
    from backend.services.session_service import SessionService

    try:
        skill_name = args["skill_name"]
        metrics = args.get("metrics") or ["quality_score", "completeness", "usage_hint"]
        dry_run = args.get("dry_run", False)

        skill_svc = SkillService()
        session_svc = SessionService()

        # 获取会话列表（用于 usage_hint）
        sessions = []
        try:
            sessions = session_svc.list_sessions()
        except Exception:
            pass

        # 确定要评估的技能列表
        if skill_name.lower() == "all":
            all_skills = skill_svc.list_skills()
            if not all_skills:
                return success_response(message="当前没有可用技能。")
            targets = all_skills
        else:
            skill_detail = skill_svc.get_skill(skill_name)
            if not skill_detail:
                return error_response(message=f"技能 '{skill_name}' 不存在")
            # 合并列表信息和详情
            all_skills_list = skill_svc.list_skills()
            skill_meta = next((s for s in all_skills_list if s["name"] == skill_name), {})
            targets = [{
                "name": skill_name,
                "description": skill_meta.get("description", ""),
                "tags": skill_meta.get("tags", []),
                "category": skill_meta.get("category", ""),
                "version": skill_meta.get("version", ""),
                "content": skill_detail.get("content", ""),
            }]

        # 逐个评估
        results = []
        for target in targets:
            name = target["name"]
            content = target.get("content", "")

            # 如果没有 content，尝试从 get_skill 获取
            if not content:
                detail = skill_svc.get_skill(name)
                if detail:
                    content = detail.get("content", "")

            description = target.get("description", "")
            tags = target.get("tags", [])
            category = target.get("category", "")
            version = target.get("version", "")

            scores = {}

            # quality_score
            if "quality_score" in metrics:
                quality = _evaluate_quality(content, description, tags)
                scores["quality_score"] = quality

            # completeness
            if "completeness" in metrics:
                completeness = _evaluate_completeness(content, category, version)
                scores["completeness"] = completeness

            # usage_hint
            if "usage_hint" in metrics:
                usage = _evaluate_usage_hint(name, sessions)
                scores["usage_hint"] = usage

            # 计算综合等级
            q = scores.get("quality_score", {}).get("score", 0)
            c = scores.get("completeness", {}).get("score", 0)
            u = scores.get("usage_hint", {}).get("score", 0)
            overall_grade = _compute_grade(q, c, u)

            # 生成建议
            suggestions = _generate_suggestions(
                scores.get("quality_score", {"score": 100, "details": []}),
                scores.get("completeness", {"score": 100, "details": []}),
                scores.get("usage_hint", {"score": 100, "details": []}),
                name,
            )

            results.append({
                "skill_name": name,
                "scores": {k: v["score"] for k, v in scores.items()},
                "score_details": {k: v["details"] for k, v in scores.items()},
                "overall_grade": overall_grade,
                "suggestions": suggestions,
            })

        # 构建输出消息
        nl = "\n"
        if len(results) == 1:
            r = results[0]
            msg_lines = [
                f"技能评估: {r['skill_name']}",
                f"综合等级: {r['overall_grade']}",
                f"{'='*40}",
            ]
            for metric_name, score_val in r["scores"].items():
                msg_lines.append(f"  {metric_name}: {score_val}/100")
                for detail in r["score_details"].get(metric_name, []):
                    msg_lines.append(f"    - {detail}")
            msg_lines.append(f"{'='*40}")
            msg_lines.append("改进建议:")
            for s in r["suggestions"]:
                msg_lines.append(f"  - {s}")
            message = nl.join(msg_lines)
        else:
            msg_lines = [f"批量评估结果 ({len(results)} 个技能)", f"{'='*50}"]
            for r in results:
                msg_lines.append(
                    f"  {r['skill_name']}: 等级 {r['overall_grade']} | "
                    f"质量 {r['scores'].get('quality_score', 'N/A')} | "
                    f"完整度 {r['scores'].get('completeness', 'N/A')} | "
                    f"使用 {r['scores'].get('usage_hint', 'N/A')}"
                )
            message = nl.join(msg_lines)

        return success_response(
            data={"results": results, "dry_run": dry_run},
            message=message,
        )
    except Exception as e:
        return error_response(message=f"技能评估失败: {e}", code="EVAL_ERROR")
