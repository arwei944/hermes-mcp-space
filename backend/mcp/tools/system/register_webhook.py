# -*- coding: utf-8 -*-
"""注册消息推送 Webhook（Telegram/飞书/Slack/Discord）"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="register_webhook",
        description="注册消息推送 Webhook（Telegram/飞书/Slack/Discord）",
        schema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "通道名称"},
                "url": {"type": "string", "description": "Webhook URL"},
                "platform": {"type": "string", "description": "平台类型（telegram/feishu/slack/discord/custom）"},
                "secret": {"type": "string", "description": "密钥（可选）"}
            },
            "required": ["name", "url", "platform"]
        },
        handler=handle,
        tags=["system"],
    )


def handle(args: dict) -> dict:
    """register_webhook handler"""
    try:
        wname = args.get("name", "")
        wurl = args.get("url", "")
        platform = args.get("platform", "custom")
        secret = args.get("secret", "")

        if not wname or not wurl:
            return error_response(
                message="请提供通道名称和 Webhook URL。\n建议：\n1. name: 自定义通道名（如 'my-telegram'）\n2. url: Webhook 地址\n3. platform: telegram/feishu/slack/discord/custom",
                code="INVALID_ARGS",
            )

        from backend.config import get_hermes_home
        import json

        webhooks_file = get_hermes_home() / "webhooks.json"
        webhooks = {}
        if webhooks_file.exists():
            webhooks = json.loads(webhooks_file.read_text(encoding="utf-8"))
        webhooks[wname] = {"url": wurl, "platform": platform, "secret": secret}
        webhooks_file.write_text(json.dumps(webhooks, indent=2, ensure_ascii=False), encoding="utf-8")

        return success_response(
            message=f"Webhook 通道 '{wname}' 已注册。\n平台: {platform}\nURL: {wurl}\n使用 send_notification 发送消息。"
        )
    except Exception as e:
        return error_response(message=f"注册 Webhook 失败: {e}", code="WEBHOOK_ERROR")
