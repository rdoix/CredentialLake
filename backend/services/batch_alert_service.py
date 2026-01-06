"""Batch alert service for scheduled job aggregated notifications"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import requests
from backend.models.scan_job import ScanJob
from sqlalchemy.orm import Session


class BatchAlertService:
    """Service for sending aggregated batch alerts from scheduled jobs"""

    @staticmethod
    def collect_job_results(db: Session, job_ids: List[str]) -> Dict:
        """
        Collect and aggregate results from multiple scan jobs.
        Returns a summary dict with per-query statistics.
        """
        results = {
            "total_queries": len(job_ids),
            "queries_with_findings": 0,
            "queries_without_findings": 0,
            "total_credentials_found": 0,
            "total_new_credentials": 0,
            "total_duplicates": 0,
            "query_details": []
        }

        for job_id in job_ids:
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if not job:
                continue

            has_findings = job.total_raw > 0
            if has_findings:
                results["queries_with_findings"] += 1
            else:
                results["queries_without_findings"] += 1

            results["total_credentials_found"] += job.total_raw
            results["total_new_credentials"] += job.total_new
            results["total_duplicates"] += job.total_duplicates

            results["query_details"].append({
                "query": job.query,
                "status": job.status,
                "total_raw": job.total_raw,
                "total_parsed": job.total_parsed,
                "total_new": job.total_new,
                "total_duplicates": job.total_duplicates,
                "has_findings": has_findings
            })

        return results

    @staticmethod
    def send_teams_batch_alert(
        webhook_url: str,
        scheduled_job_name: str,
        scan_date: datetime,
        results: Dict,
        dashboard_url: Optional[str] = None
    ) -> bool:
        """
        Send aggregated Teams alert for scheduled job batch results.
        Provides summary with per-keyword breakdown and new/duplicate info.
        """
        try:
            # Determine alert color and title based on findings
            has_findings = results["queries_with_findings"] > 0
            theme_color = "FF0000" if has_findings else "00FF00"

            if has_findings:
                title = "🚨 Credential Leak Detected - Scheduled Scan Report"
                summary = f"Found credentials in {results['queries_with_findings']} out of {results['total_queries']} keywords"
            else:
                title = "✅ No Credential Leaks Found - Scheduled Scan Report"
                summary = f"All {results['total_queries']} keywords returned clean results"

            # Build keyword details text
            query_details_text = BatchAlertService._build_query_details_text(results)

            # Derive local TZ label (e.g., 'WIB' for Asia/Jakarta) if available
            tz_label = scan_date.tzname() or "Local"

            # Build facts section
            facts = [
                {"name": "📋 Scheduled Job", "value": scheduled_job_name},
                {"name": "📅 Scan Time", "value": f"{scan_date.strftime('%Y-%m-%d %H:%M:%S')} {tz_label}"},
                {"name": "🔍 Total Keywords Scanned", "value": str(results["total_queries"])},
                {"name": "✅ Keywords with Findings", "value": str(results["queries_with_findings"])},
                {"name": "⭕ Keywords without Findings", "value": str(results["queries_without_findings"])},
            ]

            if has_findings:
                facts.extend([
                    {"name": "📊 Total Credentials Found", "value": str(results["total_credentials_found"])},
                    {"name": "🆕 New Credentials", "value": str(results["total_new_credentials"])},
                    {"name": "🔄 Duplicate Credentials", "value": str(results["total_duplicates"])},
                ])

            # Build sections
            sections = [
                {
                    "activityTitle": title,
                    "activitySubtitle": summary,
                    "facts": facts
                },
                {
                    "activityTitle": "📊 Keyword Details",
                    "text": query_details_text
                }
            ]

            # Add dashboard link if provided
            if dashboard_url:
                sections.append({
                    "activityTitle": "🔗 Next Steps",
                    "text": f"For more details, check the Credential Leak portal: {dashboard_url}"
                })

            # Compose message payload
            message = {
                "@type": "MessageCard",
                "@context": "https://schema.org/extensions",
                "summary": summary,
                "themeColor": theme_color,
                "sections": sections
            }

            # Send to Teams
            response = requests.post(webhook_url, json=message, timeout=30)
            return 200 <= response.status_code < 300

        except Exception as e:
            print(f"Error sending Teams batch alert: {e}")
            return False

    @staticmethod
    def _build_query_details_text(results: Dict) -> str:
        """Build formatted text for keyword details section"""
        lines = []
        
        # Group keywords by findings status
        queries_with_findings = [q for q in results["query_details"] if q["has_findings"]]
        queries_without_findings = [q for q in results["query_details"] if not q["has_findings"]]

        # Show keywords with findings first
        if queries_with_findings:
            lines.append("**🔴 Keywords with Credential Leaks:**")
            lines.append("")
            for idx, query in enumerate(queries_with_findings, 1):
                emoji = "🚨" if query["total_new"] > 0 else "⚠️"
                lines.append(f"{emoji} **{idx}. {query['query']}**")
                lines.append(f"  └ Total Found: {query['total_raw']} credentials")
                lines.append(f"  └ New: **{query['total_new']}** | Duplicates: {query['total_duplicates']}")
                if query["status"] != "completed":
                    lines.append(f"  └ Status: {query['status']}")
                lines.append("")

        # Show keywords without findings
        if queries_without_findings:
            if queries_with_findings:
                lines.append("---")
                lines.append("")
            lines.append("**🟢 Keywords without Findings:**")
            lines.append("")
            for query in queries_without_findings:
                lines.append(f"✅ {query['query']}")
            lines.append("")

        # Add legend
        lines.append("---")
        lines.append("**📖 Legend:**")
        lines.append("🚨 = New credentials found (requires immediate attention)")
        lines.append("⚠️ = Only duplicate credentials found")
        lines.append("✅ = No credentials found (clean)")

        return "  \n".join(lines)

    @staticmethod
    def send_slack_batch_alert(
        webhook_url: str,
        scheduled_job_name: str,
        scan_date: datetime,
        results: Dict,
        dashboard_url: Optional[str] = None
    ) -> bool:
        """Send aggregated Slack alert for scheduled job batch results"""
        try:
            has_findings = results["queries_with_findings"] > 0
            
            if has_findings:
                title = f"🚨 *Credential Leak Detected - {scheduled_job_name}*"
            else:
                title = f"✅ *No Leaks Found - {scheduled_job_name}*"

            tz_label = scan_date.tzname() or "Local"
            text_lines = [
                title,
                f"Scan Time: {scan_date.strftime('%Y-%m-%d %H:%M:%S')} {tz_label}",
                "",
                f"📊 *Summary:*",
                f"• Total Keywords: {results['total_queries']}",
                f"• With Findings: {results['queries_with_findings']}",
                f"• Without Findings: {results['queries_without_findings']}",
            ]

            if has_findings:
                text_lines.extend([
                    "",
                    f"🔍 *Credentials Found:*",
                    f"• Total: {results['total_credentials_found']}",
                    f"• New: {results['total_new_credentials']}",
                    f"• Duplicates: {results['total_duplicates']}",
                ])

            # Add keyword details
            text_lines.append("")
            text_lines.append("📋 *Keyword Details:*")
            for query in results["query_details"]:
                if query["has_findings"]:
                    emoji = "🚨" if query["total_new"] > 0 else "⚠️"
                    text_lines.append(f"{emoji} {query['query']}: {query['total_new']} new, {query['total_duplicates']} duplicates")
                else:
                    text_lines.append(f"✅ {query['query']}: No findings")

            if dashboard_url:
                text_lines.append("")
                text_lines.append(f"For more details, check the Credential Leak portal: {dashboard_url}")

            payload = {"text": "\n".join(text_lines)}
            response = requests.post(webhook_url, json=payload, timeout=30)
            return 200 <= response.status_code < 300

        except Exception:
            return False

    @staticmethod
    def send_telegram_batch_alert(
        bot_token: str,
        chat_id: str,
        scheduled_job_name: str,
        scan_date: datetime,
        results: Dict,
        dashboard_url: Optional[str] = None
    ) -> bool:
        """Send aggregated Telegram alert for scheduled job batch results"""
        try:
            has_findings = results["queries_with_findings"] > 0

            # Titles kept simple to avoid entity parsing issues
            title = "🚨 Credential Leak Detected" if has_findings else "✅ No Leaks Found"

            tz_label = scan_date.tzname() or "Local"
            text_lines = [
                title,
                f"{scheduled_job_name}",
                f"Scan: {scan_date.strftime('%Y-%m-%d %H:%M:%S')} {tz_label}",
                "",
                "📊 Summary:",
                f"Keywords: {results['queries_with_findings']}/{results['total_queries']} with findings",
            ]

            if has_findings:
                text_lines.extend([
                    f"New: {results['total_new_credentials']}",
                    f"Duplicates: {results['total_duplicates']}",
                    "",
                    "Details:"
                ])
                for query in results["query_details"]:
                    if query["has_findings"]:
                        emoji = "🚨" if query["total_new"] > 0 else "⚠️"
                        # Avoid Markdown special chars (no backticks) to prevent Telegram parse errors
                        text_lines.append(f"{emoji} {query['query']}: {query['total_new']} new")

            if dashboard_url:
                text_lines.append("")
                text_lines.append(f"For more details, check the Credential Leak portal: {dashboard_url}")

            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": "\n".join(text_lines),
                # Omit parse_mode to send plain text and avoid Markdown entity parsing issues
            }
            response = requests.post(url, json=payload, timeout=30)

            # Consider Telegram 'ok' in JSON body, not just HTTP status
            try:
                data = response.json()
            except Exception:
                data = {}
            ok = (200 <= response.status_code < 300) and bool(data.get("ok", True))
            if not ok:
                desc = data.get("description", "")
                print(f"BatchAlertService.send_telegram_batch_alert: failed status={response.status_code} ok={data.get('ok')} desc={desc[:300]}")
            return ok

        except Exception:
            return False

    @staticmethod
    def send_batch_notification(
        provider: str,
        config: Dict[str, Optional[str]],
        scheduled_job_name: str,
        scan_date: datetime,
        results: Dict,
        dashboard_url: Optional[str] = None
    ) -> bool:
        """
        Send batch notification using selected provider.
        
        Args:
            provider: 'none' | 'teams' | 'slack' | 'telegram'
            config: Dict with webhook URLs and tokens
            scheduled_job_name: Name of the scheduled job
            scan_date: When the scan was executed
            results: Aggregated results from collect_job_results()
            dashboard_url: Optional URL to dashboard for more details
        """
        provider = (provider or "none").lower()
        if provider == "none":
            return False

        if provider == "teams":
            webhook = config.get("teams_webhook_url")
            if not webhook:
                return False
            return BatchAlertService.send_teams_batch_alert(
                webhook, scheduled_job_name, scan_date, results, dashboard_url
            )

        if provider == "slack":
            webhook = config.get("slack_webhook_url")
            if not webhook:
                return False
            return BatchAlertService.send_slack_batch_alert(
                webhook, scheduled_job_name, scan_date, results, dashboard_url
            )

        if provider == "telegram":
            token = config.get("telegram_bot_token")
            chat_id = config.get("telegram_chat_id")
            if not token or not chat_id:
                return False
            return BatchAlertService.send_telegram_batch_alert(
                token, chat_id, scheduled_job_name, scan_date, results, dashboard_url
            )

        return False