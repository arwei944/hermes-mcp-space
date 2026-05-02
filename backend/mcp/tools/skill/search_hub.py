# -*- coding: utf-8 -*-
"""搜索在线技能市场（skills.sh）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="search_skills_hub",
        description="搜索在线技能市场（skills.sh）",
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "搜索关键词"},
                "limit": {"type": "integer", "default": 10, "description": "最大结果数"}
            },
            "required": ["query"]
        },
        handler=handle,
        tags=["skill"],
    )


def handle(args: dict) -> dict:
    """搜索在线技能市场（skills.sh）"""
    from backend.services.hermes_service import hermes_service

    query = args.get("query", "")
    if not query:
        return error_response(
            message="请提供搜索关键词",
            code="INVALID_ARGS",
        )
    limit = int(args.get("limit", 10))

    try:
        import urllib.request
        import urllib.parse
        import json
        url = f"https://skills.sh/api/search?q={urllib.parse.quote(query)}&limit={limit}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data:
            return success_response(
                data={"skills": [], "total": 0},
                message=f"未找到匹配 '{query}' 的技能",
            )

        # 兼容 API 返回列表或字典格式
        if isinstance(data, dict):
            data = data.get("results", data.get("skills", data.get("items", [])))
        if not isinstance(data, list):
            data = []

        if not data:
            return success_response(
                data={"skills": [], "total": 0},
                message=f"未找到匹配 '{query}' 的技能",
            )

        output = [f"搜索: {query} | 找到 {len(data)} 个技能\n{'='*50}"]
        for skill in data[:limit]:
            name = skill.get("name", "?")
            desc = skill.get("description", "无描述")[:80]
            author = skill.get("author", "")
            installs = skill.get("installs", 0)
            output.append(f"  {name} (by {author}, {installs} 安装)")
            output.append(f"    {desc}")

        return success_response(
            data={"skills": data[:limit], "total": len(data)},
            message="\n".join(output),
        )
    except Exception as e:
        # 降级：返回内置技能列表
        try:
            skills = hermes_service.list_skills()
            matched = [
                s for s in skills
                if query.lower() in s.get("name", "").lower()
                or query.lower() in s.get("description", "").lower()
            ]
            if matched:
                output = [f"在线搜索不可用，显示本地匹配结果 ({len(matched)} 个)\n{'='*50}"]
                for s in matched:
                    output.append(f"  {s['name']}: {s.get('description', '无描述')[:80]}")
                return success_response(
                    data={"skills": matched, "total": len(matched), "fallback": True},
                    message="\n".join(output),
                )
        except Exception:
            pass
        return error_response(str(e))
