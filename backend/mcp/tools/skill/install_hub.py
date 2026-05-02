# -*- coding: utf-8 -*-
"""从在线市场安装技能到本地"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="install_skill_hub",
        description="从在线市场安装技能到本地",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "技能名称（如 python-debug）"},
                "source": {"type": "string", "description": "来源 URL 或市场名称（默认 skills.sh）"}
            },
            "required": ["name"]
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """从在线市场安装技能到本地"""
    from backend.services.hermes_service import hermes_service

    skill_name = args.get("name", "")
    if not skill_name:
        return error_response(
            message="请提供技能名称",
            code="INVALID_ARGS",
        )
    source = args.get("source", "")

    try:
        import urllib.request
        import urllib.parse
        import json
        import ssl as _ssl

        if not source:
            source = f"https://skills.sh/api/v1/skills/{urllib.parse.quote(skill_name)}"

        ctx = _ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = _ssl.CERT_NONE
        req = urllib.request.Request(source, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        content = data.get("content", "")
        if not content:
            return error_response(
                message=f"技能 '{skill_name}' 内容为空",
                code="EMPTY_CONTENT",
            )

        # 使用 hermes_service 创建技能
        desc = data.get("description", f"从市场安装: {skill_name}")
        tags = data.get("tags", ["hub"])
        result = hermes_service.create_skill(skill_name, content, desc, tags)

        if result.get("success"):
            return success_response(
                data={"name": skill_name, "description": desc, "tags": tags},
                message=f"技能 '{skill_name}' 安装成功！\n描述: {desc}\n标签: {', '.join(tags)}\n使用 get_skill_content('{skill_name}') 查看内容",
            )
        else:
            return error_response(
                message=f"安装失败: {result.get('message', '未知错误')}\n建议：\n1. 技能可能已存在，使用 update_skill 更新\n2. 检查技能名称",
                code="INSTALL_FAILED",
            )
    except Exception as e:
        # 降级：通过搜索 API 获取信息，创建模板技能
        try:
            import urllib.request
            import urllib.parse
            import json
            import ssl as _ssl

            ctx = _ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = _ssl.CERT_NONE
            search_url = f"https://skills.sh/api/search?q={urllib.parse.quote(skill_name)}&limit=1"
            req = urllib.request.Request(search_url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                search_data = json.loads(resp.read().decode("utf-8"))

            skills_list = search_data.get("skills", [])
            if not skills_list:
                return error_response(
                    message=f"技能 '{skill_name}' 未在市场中找到",
                    code="NOT_FOUND",
                )

            matched = skills_list[0]
            matched_name = matched.get("name", skill_name)
            matched_source = matched.get("source", "")
            matched_installs = matched.get("installs", 0)

            # 创建模板技能
            template_content = (
                f"# {matched_name}\n\n"
                f"> 来源: skills.sh ({matched_source})\n"
                f"> 安装次数: {matched_installs}\n\n"
                f"## 说明\n\n"
                f"此技能从 skills.sh 市场安装（降级模式）。\n"
                f"完整内容请访问: https://skills.sh/s/{matched_name}\n\n"
                f"## 使用\n\n"
                f"请根据技能名称 '{matched_name}' 的用途进行配置和使用。"
            )
            desc = f"从 skills.sh 安装 (降级): {matched_name} ({matched_installs} 安装)"
            tags = ["hub", "skills-sh"]
            result = hermes_service.create_skill(skill_name, template_content, desc, tags)

            if result.get("success"):
                return success_response(
                    data={"name": skill_name, "description": desc, "tags": tags, "fallback": True},
                    message=f"技能 '{skill_name}' 安装成功（降级模式）！\n来源: {matched_source}\n安装次数: {matched_installs}\n描述: {desc}\n使用 get_skill_content('{skill_name}') 查看内容",
                )
            else:
                return error_response(
                    message=f"安装失败: {result.get('message', '未知错误')}",
                    code="INSTALL_FAILED",
                )
        except Exception as e2:
            return error_response(
                message=f"在线市场暂不可用: {e2}\n建议：\n1. 使用 create_skill 手动创建技能\n2. 稍后重试\n3. 使用 search_skills_hub 先搜索",
                code="HUB_UNAVAILABLE",
            )
