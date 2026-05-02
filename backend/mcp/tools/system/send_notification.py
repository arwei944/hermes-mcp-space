# -*- coding: utf-8 -*-
"""发送通知消息（支持配置的 Webhook 通道）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="send_notification",
        description="发送通知消息（支持配置的 Webhook 通道）",
        schema={
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "通知内容"},
                "channel": {"type": "string", "description": "通道名称（默认 default）"},
                "title": {"type": "string", "description": "通知标题（可选）"}
            },
            "required": ["message"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """send_notification handler"""
    try:
        message = args.get("message", "")
        if not message:
            return error_response(message="请提供通知内容。", code="INVALID_ARGS")
        channel = args.get("channel", "default")
        title = args.get("title", "Hermes 通知")

        from backend.config import get_hermes_home
        import json, urllib.request

        webhooks_file = get_hermes_home() / "webhooks.json"
        if not webhooks_file.exists():
            return error_response(
                message="未注册任何 Webhook 通道。请先使用 register_webhook 注册。",
                code="NO_WEBHOOK",
            )

        webhooks = json.loads(webhooks_file.read_text(encoding="utf-8"))
        target = webhooks.get(channel) or webhooks.get("default")
        if not target:
            available = ", ".join(webhooks.keys())
            return error_response(
                message=f"通道 '{channel}' 不存在。可用通道: {available}",
                code="CHANNEL_NOT_FOUND",
            )

        wurl = target["url"]
        platform = target.get("platform", "custom")

        # 根据平台格式化 payload
        if platform == "feishu":
            payload = json.dumps({"msg_type": "text", "content": {"text": f"{title}\n{message}"}}).encode("utf-8")
        elif platform == "slack":
            payload = json.dumps({"text": f"*{title}*\n{message}"}).encode("utf-8")
        elif platform == "discord":
            payload = json.dumps({"content": f"**{title}**\n{message}"}).encode("utf-8")
        elif platform == "telegram":
            payload = json.dumps({"text": f"*{title}*\n{message}", "parse_mode": "Markdown"}).encode("utf-8")
        else:
            payload = json.dumps({"title": title, "message": message}).encode("utf-8")

        req = urllib.request.Request(wurl, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read().decode("utf-8")

        return success_response(
            message=f"通知已发送到 '{channel}' ({platform})。\n标题: {title}\n内容: {message[:100]}"
        )
    except Exception as e:
        return error_response(
            message=f"发送通知失败: {e}\n建议：\n1. 检查 Webhook URL 是否正确\n2. 确认网络连接\n3. 检查平台密钥配置",
            code="NOTIFY_ERROR",
        )
