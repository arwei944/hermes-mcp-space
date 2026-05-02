# -*- coding: utf-8 -*-
"""获取操作日志（按来源过滤）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="get_logs",
        description="获取操作日志（按来源过滤）",
        schema={
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 20, "description": "返回的最大日志数"},
                "source": {"type": "string", "description": "来源过滤（mcp/user/system）"}
            }
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """get_logs handler"""
    try:
        from backend.routers.logs import _load_logs

        logs = _load_logs()
        source = args.get("source")
        if source:
            logs = [l for l in logs if l.get("source") == source]
        limit = args.get("limit", 20)
        logs = logs[:limit]
        if not logs:
            return success_response("当前没有日志记录")
        lines = []
        for log in logs:
            lines.append(
                f"- [{log.get('source', '?')}] {log.get('action', '?')} | {log.get('timestamp', '?')}"
            )
        result = f"共 {len(logs)} 条日志:\n" + "\n".join(lines)
        return success_response(result)
    except Exception as e:
        return error_response(f"获取日志失败: {e}")
