# -*- coding: utf-8 -*-
"""
email_operations - 邮件操作工具
支持发送邮件和查看 SMTP 配置
"""

from backend.mcp.tools._base import register_tool, success_response, error_response


def register(reg):
    register_tool(
        reg,
        name="email_operations",
        description="Email operations: send emails via SMTP or list current SMTP configuration (password masked).",
        schema={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["send", "list_config"],
                    "description": "Action: send (an email) or list_config (view current SMTP config)",
                },
                "to": {
                    "type": "string",
                    "description": "Recipient email address (for send)",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject (for send)",
                },
                "body": {
                    "type": "string",
                    "description": "Email body content (for send)",
                },
                "html": {
                    "type": "boolean",
                    "description": "If true, send as HTML email. Default: false",
                    "default": False,
                },
                "smtp_host": {
                    "type": "string",
                    "description": "SMTP server host (optional, uses saved config if not provided)",
                },
                "smtp_port": {
                    "type": "number",
                    "description": "SMTP server port (optional, uses saved config if not provided)",
                },
                "smtp_user": {
                    "type": "string",
                    "description": "SMTP username (optional, uses saved config if not provided)",
                },
                "smtp_pass": {
                    "type": "string",
                    "description": "SMTP password (optional, uses saved config if not provided)",
                },
            },
            "required": ["action"],
        },
        handler=handle,
        tags=["system", "email"],
    )


def _get_config_file():
    """Get the path to email_config.json."""
    import os
    from pathlib import Path

    hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
    data_dir = Path(hermes_home) / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "email_config.json"


def _load_config():
    """Load email config from JSON file."""
    import json

    config_file = _get_config_file()
    if config_file.exists():
        with open(config_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_config(config):
    """Save email config to JSON file."""
    import json

    config_file = _get_config_file()
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def _mask_password(password: str) -> str:
    """Mask password for display, showing only first and last character."""
    if not password or len(password) <= 2:
        return "****"
    return password[0] + "*" * (len(password) - 2) + password[-1]


def handle(args: dict) -> dict:
    try:
        action = args.get("action", "")

        if not action:
            return error_response("Action is required")

        if action == "list_config":
            config = _load_config()
            # Mask password before returning
            display_config = dict(config)
            if display_config.get("smtp_pass"):
                display_config["smtp_pass"] = _mask_password(display_config["smtp_pass"])

            return success_response(
                data={
                    "config": display_config,
                    "configured": bool(config.get("smtp_host")),
                },
                message="Current SMTP configuration (password masked)",
            )

        elif action == "send":
            to = args.get("to", "").strip()
            subject = args.get("subject", "").strip()
            body = args.get("body", "").strip()
            is_html = args.get("html", False)
            smtp_host = args.get("smtp_host", "").strip()
            smtp_port = args.get("smtp_port")
            smtp_user = args.get("smtp_user", "").strip()
            smtp_pass = args.get("smtp_pass", "").strip()

            if not to:
                return error_response("Recipient email (to) is required for send")
            if not subject:
                return error_response("Subject is required for send")
            if not body:
                return error_response("Body is required for send")

            # Merge with saved config (CLI args take priority)
            saved_config = _load_config()
            final_host = smtp_host or saved_config.get("smtp_host", "")
            final_port = smtp_port or saved_config.get("smtp_port", 587)
            final_user = smtp_user or saved_config.get("smtp_user", "")
            final_pass = smtp_pass or saved_config.get("smtp_pass", "")

            if not final_host:
                return error_response(
                    "SMTP host not configured. Provide smtp_host or configure it first."
                )

            # Save config if new values were provided
            if smtp_host or smtp_port or smtp_user or smtp_pass:
                update_config = dict(saved_config)
                if smtp_host:
                    update_config["smtp_host"] = smtp_host
                if smtp_port:
                    update_config["smtp_port"] = smtp_port
                if smtp_user:
                    update_config["smtp_user"] = smtp_user
                if smtp_pass:
                    update_config["smtp_pass"] = smtp_pass
                _save_config(update_config)

            # Send email using smtplib
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            if is_html:
                msg = MIMEMultipart("alternative")
                msg.attach(MIMEText(body, "html", "utf-8"))
            else:
                msg = MIMEText(body, "plain", "utf-8")

            msg["Subject"] = subject
            msg["From"] = final_user
            msg["To"] = to

            try:
                if final_port == 465:
                    # SSL connection
                    server = smtplib.SMTP_SSL(final_host, int(final_port), timeout=30)
                else:
                    # STARTTLS connection (default for port 587)
                    server = smtplib.SMTP(final_host, int(final_port), timeout=30)
                    server.starttls()

                if final_user and final_pass:
                    server.login(final_user, final_pass)

                server.sendmail(final_user, [to], msg.as_string())
                server.quit()

                return success_response(
                    data={
                        "to": to,
                        "subject": subject,
                        "smtp_host": final_host,
                        "smtp_port": final_port,
                    },
                    message=f"Email sent successfully to {to}",
                )

            except smtplib.SMTPAuthenticationError:
                return error_response("SMTP authentication failed. Check smtp_user and smtp_pass.")
            except smtplib.SMTPConnectError:
                return error_response(f"Failed to connect to SMTP server {final_host}:{final_port}")
            except smtplib.SMTPException as e:
                return error_response(f"SMTP error: {str(e)}")
            except Exception as e:
                return error_response(f"Failed to send email: {str(e)}")

        else:
            return error_response(f"Unknown action: {action}. Use: send, list_config")

    except Exception as e:
        return error_response(str(e))
