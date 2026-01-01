#!/usr/bin/env python3
# Microsoft Teams Notifier
# Ports and improves send_teams_alert from legacy test8.py
# - Clarifies raw vs parsed counts
# - Safer webhook sending with timeouts and error handling
# - Priority grouping for readable alerts

from typing import List, Dict, Optional, Tuple, Any
import requests
from datetime import datetime
from termcolor import colored
import colorama

colorama.init(autoreset=True)

def _is_admin_line(text: str) -> bool:
    admin_keywords = ['admin', 'administrator', 'root', 'superuser', 'sysadmin', 'webadmin', 'dbadmin']
    lt = text.lower()
    return any(k in lt for k in admin_keywords)

def _normalize_credentials_input(credentials: List[Any]) -> List[str]:
    """
    Normalize credentials input to a list of strings suitable for Teams message.
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

def _build_priority_groups_for_file_mode(parsed_credentials: List[Dict[str, str]]) -> Tuple[List[Dict[str,str]], List[Dict[str,str]], List[Dict[str,str]], List[Dict[str,str]]]:
    """
    Group parsed credentials into priority buckets for file mode alerts:
    - priority_1: admin + .id domain
    - priority_2: admin only
    - priority_3: .id domain only
    - priority_4: others
    """
    admin_keywords = ['admin', 'administrator', 'root', 'superuser', 'sysadmin', 'webadmin', 'dbadmin']
    p1: List[Dict[str,str]] = []
    p2: List[Dict[str,str]] = []
    p3: List[Dict[str,str]] = []
    p4: List[Dict[str,str]] = []

    for cred in parsed_credentials:
        line = f"{cred.get('url','')}:{cred.get('username','')}:{cred.get('password','')}".lower()
        has_admin = any(keyword in line for keyword in admin_keywords)
        has_id_domain = '.id' in line

        if has_admin and has_id_domain:
            p1.append(cred)
        elif has_admin:
            p2.append(cred)
        elif has_id_domain:
            p3.append(cred)
        else:
            p4.append(cred)

    return p1, p2, p3, p4

def _format_priority_blocks_for_file_mode(parsed_credentials: List[Dict[str,str]]) -> Tuple[str, int]:
    """
    Create a formatted text block for Teams listing top credentials by priority.
    Returns (text, count_listed).
    """
    p1, p2, p3, p4 = _build_priority_groups_for_file_mode(parsed_credentials)

    credential_details: List[str] = []
    credential_count = 0

    # Top N per category
    for cred in p1[:5]:
        credential_count += 1
        credential_block = f"🚨 **{credential_count}.** {cred.get('url','')}"
        credential_block += f"  \n└ User: `{cred.get('username','')}`"
        credential_block += f"  \n└ Pass: `{cred.get('password','')}`"
        credential_details.append(credential_block)

    for cred in p2[:5]:
        credential_count += 1
        credential_block = f"⚠️ **{credential_count}.** {cred.get('url','')}"
        credential_block += f"  \n└ User: `{cred.get('username','')}`"
        credential_block += f"  \n└ Pass: `{cred.get('password','')}`"
        credential_details.append(credential_block)

    for cred in p3[:3]:
        credential_count += 1
        credential_block = f"🇮🇩 **{credential_count}.** {cred.get('url','')}"
        credential_block += f"  \n└ User: `{cred.get('username','')}`"
        credential_block += f"  \n└ Pass: `{cred.get('password','')}`"
        credential_details.append(credential_block)

    for cred in p4[:2]:
        credential_count += 1
        credential_block = f"✅ **{credential_count}.** {cred.get('url','')}"
        credential_block += f"  \n└ User: `{cred.get('username','')}`"
        credential_block += f"  \n└ Pass: `{cred.get('password','')}`"
        credential_details.append(credential_block)

    # Priority summary
    if p1 or p2 or p3:
        summary = ["  \n**Priority Summary:**"]
        if p1: summary.append(f"  \n🚨 Critical (Admin + .id): {len(p1)}")
        if p2: summary.append(f"  \n⚠️ High (Admin): {len(p2)}")
        if p3: summary.append(f"  \n🇮🇩 Medium (.id domains): {len(p3)}")
        credential_details.append("".join(summary))

    return "  \n  \n".join(credential_details), credential_count

def _format_generic_blocks_for_non_file_mode(parser_instance, max_items: int = 15) -> Tuple[str, int]:
    """
    Create a formatted text block for Teams using parser_instance.parsed_credentials
    in non-file mode (IntelX). Marks admin-like credentials.
    """
    credential_details: List[str] = []
    credential_count = 0

    if parser_instance and getattr(parser_instance, 'parsed_credentials', None):
        for cred in parser_instance.parsed_credentials[:max_items]:
            credential_count += 1
            is_admin = _is_admin_line(cred.get('username', '')) or _is_admin_line(cred.get('password', ''))
            emoji = "❗" if is_admin else "✅"
            credential_block = f"{emoji} **{credential_count}.** {cred.get('url','')}"
            credential_block += f"  \n└ User: `{cred.get('username','')}`"
            credential_block += f"  \n└ Pass: `{cred.get('password','')}`"
            credential_details.append(credential_block)

    return "  \n  \n".join(credential_details), credential_count

def send_teams_alert(
    webhook_url: str,
    query: str,
    credentials: List[Any],
    domains: List[str],
    csv_file: str,
    parser_instance=None,
    is_file_mode: bool = False
) -> bool:
    """
    Send alert to Microsoft Teams via webhook.
    credentials: list of raw lines or list of dicts with 'line' key (IntelX mode).
    parser_instance: object with .parsed_credentials if available.
    """
    try:
        # Prepare counts
        normalized_lines = _normalize_credentials_input(credentials)
        raw_count = len(normalized_lines)
        parsed_count = len(getattr(parser_instance, 'parsed_credentials', [])) if parser_instance else 0

        # Domains string
        domains_str = ", ".join(domains) if domains else "Unknown"

        title = "🚨 Credential Leak Alert"

        # Build credential details text
        credential_details_text = ""
        listed_count = 0

        if is_file_mode and parser_instance and parsed_count > 0:
            credential_details_text, listed_count = _format_priority_blocks_for_file_mode(parser_instance.parsed_credentials)
            legend_text = "🚨 = Critical (Admin + .id)  \n⚠️ = Admin credential  \n🇮🇩 = .id domain  \n✅ = Regular credential"
        else:
            credential_details_text, listed_count = _format_generic_blocks_for_non_file_mode(parser_instance)
            legend_text = "❗ = Admin/Important credential  \n✅ = Parsed credential"

        # Add remainder summary if there are more credentials
        total_remaining = raw_count - listed_count
        if total_remaining > 0:
            credential_details_text = (credential_details_text + "  \n  \n" if credential_details_text else "") + f"**... and {total_remaining} more credentials (check CSV or raw input)**"

        # Compose message payload
        message = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": f"Credential leak detected for {query}",
            "themeColor": "FF0000",
            "sections": [
                {
                    "activityTitle": title,
                    "activitySubtitle": f"Credential leak detected for: **{query}**",
                    "facts": [
                        {"name": "🎯 Search Query", "value": query},
                        {"name": "🌐 Affected Domains", "value": domains_str},
                        {"name": "📊 Total Raw Credentials", "value": str(raw_count)},
                        {"name": "🔍 Parsed Credentials", "value": str(parsed_count)},
                        {"name": "📅 Scan Date", "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
                        {"name": "📄 CSV File", "value": csv_file}
                    ]
                },
                {
                    "activityTitle": "🔍 Credential Details",
                    "text": credential_details_text or "_No parsed credentials to list_"
                },
                {
                    "activityTitle": "📖 Legend",
                    "text": legend_text
                }
            ]
        }

        # Send
        print(colored("📤 Sending Teams alert...", 'cyan'))
        response = requests.post(webhook_url, json=message, timeout=30)
        
        if response.status_code == 200:
            print(colored("✅ Teams alert sent successfully!", 'green'))
            return True
        else:
            print(colored(f"❌ Failed to send Teams alert: {response.status_code}", 'red'))
            try:
                print(colored(f"Response: {response.text}", 'red'))
            except Exception:
                pass
            return False

    except Exception as e:
        print(colored(f"❌ Error sending Teams alert: {str(e)}", 'red'))
        return False