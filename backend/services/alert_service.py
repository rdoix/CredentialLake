"""Alert service supporting Teams, Slack, and Telegram with provider selection"""
import sys
import os
from typing import List, Optional, Dict

import requests

# Import from backend directory
from backend.notifier import send_teams_alert  # Existing Teams card formatter


def _normalize_credentials_input(credentials: List) -> List[str]:
    """
    Normalize credentials input to a list of strings suitable for simple text messages.
    Accepts either list of raw lines (str) or list of dicts with 'line' key.
    """
    normalized: List[str] = []
    for item in credentials:
        if isinstance(item, str):
            normalized.append(item)
        elif isinstance(item, dict) and 'line' in item:
            normalized.append(str(item['line']))
        else:
            normalized.append(str(item))
    return normalized


def _build_text_summary(query: str, domains: List[str], raw_lines: List[str], parser_instance=None, limit: int = 15) -> str:
    """
    Build a concise text summary for Slack/Telegram payloads.
    Attempts to list parsed credentials if parser_instance is provided; otherwise shows raw lines.
    """
    title = f"Credential leak detected for: {query}"
    domains_str = ", ".join(domains) if domains else "Unknown"
    lines = []
    lines.append(f"Alert: {title}")
    lines.append(f"Domains: {domains_str}")
    lines.append(f"Total raw credentials: {len(raw_lines)}")

    listed = 0
    if parser_instance and getattr(parser_instance, 'parsed_credentials', None):
        lines.append("Top parsed credentials:")
        for cred in parser_instance.parsed_credentials[:limit]:
            listed += 1
            is_admin = False
            u = cred.get('username', '') or ''
            p = cred.get('password', '') or ''
            lt = f"{u} {p}".lower()
            for k in ['admin', 'administrator', 'root', 'superuser', 'sysadmin', 'webadmin', 'dbadmin']:
                if k in lt:
                    is_admin = True
                    break
            emoji = "❗" if is_admin else "✅"
            lines.append(f"{emoji} {listed}. {cred.get('url','')} | {u} | {p}")
    else:
        lines.append("Top raw credentials:")
        for raw in raw_lines[:limit]:
            listed += 1
            lines.append(f"✅ {listed}. {raw}")

    remaining = max(0, len(raw_lines) - listed)
    if remaining > 0:
        lines.append(f"... and {remaining} more credentials (check CSV or raw input)")

    return "\n".join(lines)


class AlertService:
    """Service for sending alerts to selected provider"""

    @staticmethod
    def send_teams_notification(
        webhook_url: str,
        query: str,
        credentials: List,
        domains: List[str],
        csv_file: str,
        parser_instance=None,
        is_file_mode: bool = False
    ) -> bool:
        """
        Send Teams alert notification via existing notifier module.
        Returns True if successful, False otherwise.
        """
        return send_teams_alert(
            webhook_url,
            query,
            credentials,
            domains,
            csv_file,
            parser_instance,
            is_file_mode
        )

    @staticmethod
    def send_slack_notification(
        webhook_url: str,
        query: str,
        credentials: List,
        domains: List[str],
        parser_instance=None
    ) -> bool:
        """
        Send Slack Incoming Webhook notification with simple text summary.
        """
        try:
            raw_lines = _normalize_credentials_input(credentials)
            text = _build_text_summary(query, domains, raw_lines, parser_instance, limit=15)
            payload = {"text": text}
            resp = requests.post(webhook_url, json=payload, timeout=30)
            return 200 <= resp.status_code < 300
        except Exception:
            return False

    @staticmethod
    def send_telegram_notification(
        bot_token: str,
        chat_id: str,
        query: str,
        credentials: List,
        domains: List[str],
        parser_instance=None
    ) -> bool:
        """
        Send Telegram message via Bot API.
        """
        try:
            raw_lines = _normalize_credentials_input(credentials)
            text = _build_text_summary(query, domains, raw_lines, parser_instance, limit=10)
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            resp = requests.post(url, json=payload, timeout=30)
            return 200 <= resp.status_code < 300
        except Exception:
            return False

    @staticmethod
    def send_notification(
        provider: str,
        config: Dict[str, Optional[str]],
        query: str,
        credentials: List,
        domains: List[str],
        csv_file: str = "",
        parser_instance=None,
        is_file_mode: bool = False
    ) -> bool:
        """
        Send notification using provider selection.
        provider: 'none' | 'teams' | 'slack' | 'telegram'
        config keys:
          - teams_webhook_url
          - slack_webhook_url
          - telegram_bot_token
          - telegram_chat_id
        """
        provider = (provider or "none").lower()
        if provider == "none":
            return False

        if provider == "teams":
            webhook = config.get("teams_webhook_url")
            if not webhook:
                return False
            return AlertService.send_teams_notification(
                webhook, query, credentials, domains, csv_file, parser_instance, is_file_mode
            )

        if provider == "slack":
            webhook = config.get("slack_webhook_url")
            if not webhook:
                return False
            return AlertService.send_slack_notification(
                webhook, query, credentials, domains, parser_instance
            )

        if provider == "telegram":
            token = config.get("telegram_bot_token")
            chat_id = config.get("telegram_chat_id")
            if not token or not chat_id:
                return False
            return AlertService.send_telegram_notification(
                token, chat_id, query, credentials, domains, parser_instance
            )

        # Unknown provider
        return False