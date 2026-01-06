"""RQ task: send aggregated batch alert after a scheduled job's scans complete.

This is defined as a module-level function to avoid RQ serializing a bound class method
that contains a scheduler attribute (which triggers APScheduler's 'Schedulers cannot be serialized' error).
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import List

from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.scan_job import ScanJob
from backend.models.scheduled_job import ScheduledJob
from backend.models.settings import AppSettings
from backend.services.batch_alert_service import BatchAlertService
from backend.config import settings


def send_batch_alert_after_completion_task(
    scheduled_job_id: str,
    job_ids: List[str],
    scheduled_job_name: str,
    scan_date: datetime
) -> None:
    """
    Poll for all scan jobs to complete then send a single aggregated batch alert
    using provider derived from ScheduledJob flags and credentials/config stored in AppSettings.

    Args:
        scheduled_job_id: UUID string of ScheduledJob
        job_ids: list of ScanJob UUID strings created for this scheduled run
        scheduled_job_name: human-friendly job name
        scan_date: when the scheduled job started; will be converted to Asia/Jakarta for display
    """
    print(f"[batch_alert_task] start scheduled_job_id={scheduled_job_id} job_ids={len(job_ids)} name={scheduled_job_name}")

    db: Session = SessionLocal()
    try:
        # Poll for job completion (max 30 minutes)
        max_wait_seconds = 1800
        poll_interval = 5  # faster feedback
        elapsed = 0

        while elapsed < max_wait_seconds:
            # Ensure we don't read stale ORM state
            try:
                db.expire_all()
            except Exception:
                pass

            all_complete = True
            incomplete_statuses = []
            for job_id in job_ids:
                job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
                st = getattr(job, "status", None) if job else None
                if not job or st not in ['completed', 'failed', 'cancelled']:
                    all_complete = False
                    incomplete_statuses.append((job_id, st))
            if all_complete:
                print(f"[batch_alert_task] all jobs completed after {elapsed}s")
                break

            print(f"[batch_alert_task] waiting... elapsed={elapsed}s incomplete={len(incomplete_statuses)} statuses={incomplete_statuses[:4]}")
            time.sleep(poll_interval)
            elapsed += poll_interval

        if not all_complete:
            print(f"[batch_alert_task] timeout waiting after {elapsed}s (attempting send with partial results)")

        # Collect results from all jobs
        results = BatchAlertService.collect_job_results(db, job_ids)
        print(f"[batch_alert_task] results summary: queries_with_findings={results.get('queries_with_findings')} total_credentials_found={results.get('total_credentials_found')}")

        # Provider and config from settings + scheduled job flags
        sj = db.query(ScheduledJob).filter(ScheduledJob.id == uuid.UUID(scheduled_job_id)).first()
        if not sj:
            print("[batch_alert_task] scheduled job not found; abort")
            return

        app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if not app_settings:
            print("[batch_alert_task] app settings not found; abort")
            return

        # Determine provider from scheduled job flags
        provider = "none"
        if sj.notify_telegram:
            provider = "telegram"
        elif sj.notify_slack:
            provider = "slack"
        elif sj.notify_teams:
            provider = "teams"

        config = {
            "teams_webhook_url": app_settings.teams_webhook_url if app_settings else None,
            "slack_webhook_url": app_settings.slack_webhook_url if app_settings else None,
            "telegram_bot_token": app_settings.telegram_bot_token if app_settings else None,
            "telegram_chat_id": app_settings.telegram_chat_id if app_settings else None
        }

        # Convert scan_date to Asia/Jakarta for local UX
        try:
            local_scan_date = scan_date.astimezone(ZoneInfo("Asia/Jakarta"))
        except Exception:
            local_scan_date = scan_date

        dashboard_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"

        print(f"[batch_alert_task] sending batch alert provider={provider} cfg={{'teams': {bool(config.get('teams_webhook_url'))}, 'slack': {bool(config.get('slack_webhook_url'))}, 'telegram_token': {bool(config.get('telegram_bot_token'))}, 'telegram_chat_id': {bool(config.get('telegram_chat_id'))}}}")

        ok = BatchAlertService.send_batch_notification(
            provider=provider,
            config=config,
            scheduled_job_name=scheduled_job_name,
            scan_date=local_scan_date,
            results=results,
            dashboard_url=dashboard_url
        )

        if not ok:
            print("[batch_alert_task] send_batch_notification returned False (check provider config or network)")
        else:
            print("[batch_alert_task] batch alert sent successfully")

    except Exception as e:
        print(f"[batch_alert_task] exception: {e}")
    finally:
        db.close()