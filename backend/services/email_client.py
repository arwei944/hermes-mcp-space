# -*- coding: utf-8 -*-
"""
email_client - 简单 SMTP 邮件客户端服务
读取 email_config.json，提供 send_email(to, subject, body, html) 方法
"""

import os
import json
import smtplib
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any


class EmailClient:
    """Simple SMTP email client."""

    def __init__(self):
        self._config_file: Optional[Path] = None

    @property
    def config_file(self) -> Path:
        """Lazy-resolve the config file path."""
        if self._config_file is None:
            hermes_home = os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))
            data_dir = Path(hermes_home) / "data"
            data_dir.mkdir(parents=True, exist_ok=True)
            self._config_file = data_dir / "email_config.json"
        return self._config_file

    def load_config(self) -> Dict[str, Any]:
        """Load email configuration from JSON file."""
        if self.config_file.exists():
            with open(self.config_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def save_config(self, config: Dict[str, Any]) -> None:
        """Save email configuration to JSON file."""
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

    def update_config(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_user: Optional[str] = None,
        smtp_pass: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Update SMTP configuration. Only non-None values are updated.

        Returns:
            Updated config dict.
        """
        config = self.load_config()
        if smtp_host is not None:
            config["smtp_host"] = smtp_host
        if smtp_port is not None:
            config["smtp_port"] = smtp_port
        if smtp_user is not None:
            config["smtp_user"] = smtp_user
        if smtp_pass is not None:
            config["smtp_pass"] = smtp_pass
        self.save_config(config)
        return config

    def get_masked_config(self) -> Dict[str, Any]:
        """Get config with password masked for display."""
        config = self.load_config()
        display = dict(config)
        if display.get("smtp_pass"):
            pwd = display["smtp_pass"]
            if len(pwd) <= 2:
                display["smtp_pass"] = "****"
            else:
                display["smtp_pass"] = pwd[0] + "*" * (len(pwd) - 2) + pwd[-1]
        return display

    def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: bool = False,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_user: Optional[str] = None,
        smtp_pass: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send an email via SMTP.

        Args:
            to: Recipient email address.
            subject: Email subject.
            body: Email body content.
            html: If True, send as HTML. Default False.
            smtp_host: Override SMTP host.
            smtp_port: Override SMTP port.
            smtp_user: Override SMTP username.
            smtp_pass: Override SMTP password.

        Returns:
            Dict with send result details.

        Raises:
            ValueError: If required config is missing.
            smtplib.SMTPException: If sending fails.
        """
        # Merge config: explicit args > saved config > defaults
        config = self.load_config()
        final_host = smtp_host or config.get("smtp_host", "")
        final_port = smtp_port or config.get("smtp_port", 587)
        final_user = smtp_user or config.get("smtp_user", "")
        final_pass = smtp_pass or config.get("smtp_pass", "")

        if not final_host:
            raise ValueError(
                "SMTP host not configured. Call update_config() or provide smtp_host."
            )

        # Build message
        if html:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(body, "html", "utf-8"))
        else:
            msg = MIMEText(body, "plain", "utf-8")

        msg["Subject"] = subject
        msg["From"] = final_user
        msg["To"] = to

        # Connect and send
        if final_port == 465:
            server = smtplib.SMTP_SSL(final_host, int(final_port), timeout=30)
        else:
            server = smtplib.SMTP(final_host, int(final_port), timeout=30)
            server.starttls()

        try:
            if final_user and final_pass:
                server.login(final_user, final_pass)
            server.sendmail(final_user, [to], msg.as_string())
            return {
                "success": True,
                "to": to,
                "subject": subject,
                "smtp_host": final_host,
                "smtp_port": final_port,
            }
        finally:
            server.quit()

    def is_configured(self) -> bool:
        """Check if SMTP is configured."""
        config = self.load_config()
        return bool(config.get("smtp_host"))


# Module-level singleton
_client: Optional[EmailClient] = None


def get_client() -> EmailClient:
    """Get the global EmailClient instance."""
    global _client
    if _client is None:
        _client = EmailClient()
    return _client
