"""APScheduler-backed service to trigger IntelX scans and CVE syncs on a cron schedule.

This service:
- Loads persisted jobs from DB (ScheduledJob) on startup
- Registers Cron triggers in Asia/Jakarta (or per-job timezone)
- Enqueues RQ jobs to run [process_intelx_scan()](backend/workers/scan_worker.py:22) for each keyword
- Runs automatic CVE sync daily at 2 AM Jakarta time
- Updates last_run/next_run telemetry fields
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, List

from zoneinfo import ZoneInfo
import logging

# APScheduler is optional; fallback gracefully if not installed
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    HAS_APSCHEDULER = True
except ImportError:
    BackgroundScheduler = None
    CronTrigger = None
    HAS_APSCHEDULER = False

from redis import Redis
from rq import Queue

from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import SessionLocal
from backend.models.scheduled_job import ScheduledJob
from backend.models.scan_job import ScanJob
from backend.models.settings import AppSettings
from backend.workers.scan_worker import process_intelx_scan
from backend.services.batch_alert_service import BatchAlertService
from backend.workers.batch_alert_task import send_batch_alert_after_completion_task

logger = logging.getLogger(__name__)


class SchedulerService:
    """Manages cron-based scheduled IntelX scans."""
    def __init__(self) -> None:
        # Use a background scheduler for FastAPI app lifecycle (optional)
        self.scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Jakarta")) if HAS_APSCHEDULER else None
        if not HAS_APSCHEDULER:
            logger.warning("APScheduler not installed; scheduler triggers disabled. Install 'apscheduler' to enable cron scheduling.")
        self._aps_job_ids: Dict[str, str] = {}  # map scheduled_job.id -> apscheduler job id

        # Own RQ queue connection (independent from route module)
        self.redis_conn = Redis.from_url(settings.REDIS_URL)
        self.job_queue = Queue(connection=self.redis_conn)

    def start(self) -> None:
        """Start APScheduler and register all active ScheduledJob entries + CVE auto-sync."""
        if not HAS_APSCHEDULER:
            # No scheduler available; still allow manual run-now via API
            return

        if not self.scheduler.running:
            self.scheduler.start()

        # Register CVE auto-sync job (daily at 2 AM Jakarta time)
        self._register_cve_auto_sync()

        db: Session = SessionLocal()
        try:
            jobs: List[ScheduledJob] = db.query(ScheduledJob).filter(ScheduledJob.is_active == True).all()
            for sj in jobs:
                # Register trigger for each job
                self._register_aps_job(sj)
        finally:
            db.close()

    def shutdown(self) -> None:
        """Shutdown scheduler cleanly."""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    def _register_aps_job(self, sj: ScheduledJob) -> None:
        """Register a cron job with APScheduler for the ScheduledJob."""
        if not HAS_APSCHEDULER or not self.scheduler:
            return

        tz = ZoneInfo(sj.timezone) if sj.timezone else ZoneInfo("Asia/Jakarta")
        trigger = CronTrigger.from_crontab(sj.schedule, timezone=tz)

        aps_job_id = f"sched-{sj.id}"
        self._aps_job_ids[str(sj.id)] = aps_job_id

        # Remove existing APS job if present (idempotent registration)
        existing = self.scheduler.get_job(aps_job_id)
        if existing:
            self.scheduler.remove_job(aps_job_id)

        self.scheduler.add_job(
            self._run_scheduled_job,
            trigger=trigger,
            id=aps_job_id,
            kwargs={"scheduled_job_id": str(sj.id)},
            replace_existing=True,
            misfire_grace_time=300,  # 5 minutes grace
            coalesce=True,
            max_instances=1,
        )

        # Update next_run telemetry immediately (store in UTC to avoid tz drift)
        job_ref = self.scheduler.get_job(aps_job_id)
        next_run_time = job_ref.next_run_time if job_ref else None
        if next_run_time:
            try:
                next_run_time = next_run_time.astimezone(timezone.utc)
            except Exception:
                # If not tz-aware, assume scheduler timezone and convert to UTC
                next_run_time = datetime.now(timezone.utc)
        self._update_next_run(str(sj.id), next_run_time)

    def _update_next_run(self, scheduled_job_id: str, next_run_time: Optional[datetime]) -> None:
        db: Session = SessionLocal()
        try:
            sj = db.query(ScheduledJob).filter(ScheduledJob.id == uuid.UUID(scheduled_job_id)).first()
            if sj:
                sj.next_run = next_run_time
                db.commit()
        finally:
            db.close()

    def _update_last_run(self, scheduled_job_id: str, ts: datetime) -> None:
        db: Session = SessionLocal()
        try:
            sj = db.query(ScheduledJob).filter(ScheduledJob.id == uuid.UUID(scheduled_job_id)).first()
            if sj:
                sj.last_run = ts
                db.commit()
        finally:
            db.close()

    def _run_scheduled_job(self, scheduled_job_id: str) -> None:
        """APS callback: enqueue RQ jobs for each keyword in the ScheduledJob."""
        # Use UTC to persist last_run to avoid 7-hour drift between UI panels
        now = datetime.now(timezone.utc)

        db: Session = SessionLocal()
        try:
            sj = db.query(ScheduledJob).filter(ScheduledJob.id == uuid.UUID(scheduled_job_id)).first()
            if not sj:
                return

            # If job is paused, skip entirely without updating last_run
            if not sj.is_active:
                logger.info(f"scheduler_service._run_scheduled_job: ScheduledJob {scheduled_job_id} is paused; skipping trigger without touching last_run")
                return

            # Only update last_run when the job is actually going to run
            self._update_last_run(scheduled_job_id, now)

            keywords = sj.get_keywords_list()
            if not keywords:
                return

            send_alert = bool(sj.notify_telegram or sj.notify_slack or sj.notify_teams)
            max_results = 100
            # Determine display_limit from AppSettings, bounded by max_display_limit
            try:
                app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
            except Exception:
                app_settings = None

            if app_settings:
                ddl = app_settings.default_display_limit or 50
                mdl = app_settings.max_display_limit or 500
                try:
                    ddl = int(ddl)
                except Exception:
                    ddl = 50
                try:
                    mdl = int(mdl)
                except Exception:
                    mdl = 500
                display_limit = max(1, min(ddl, mdl))
            else:
                display_limit = 50

            # Generate a single batch_id for all jobs in this execution
            batch_id = uuid.uuid4()

            # Track job IDs for batch alert aggregation
            job_ids = []

            for kw in keywords:
                # Create a ScanJob row to track execution
                job_id = str(uuid.uuid4())
                job_row = ScanJob(
                    id=job_id,
                    job_type="intelx_single",
                    name=sj.name,
                    query=kw,
                    time_filter=sj.time_filter or "D1",
                    batch_id=batch_id,  # Assign batch_id to group related jobs
                    status="queued",
                )
                db.add(job_row)
                db.commit()
                
                # Store job ID for batch alert
                job_ids.append(job_id)

                # Enqueue the actual worker task WITHOUT individual alerts
                enq_job = self.job_queue.enqueue(
                    process_intelx_scan,
                    job_id,
                    kw,
                    max_results,
                    sj.time_filter or "D1",
                    display_limit,
                    False,  # Disable individual alerts - we'll send batch alert instead
                    job_timeout=settings.JOB_TIMEOUT,
                )
                # Persist RQ job id to enable cancellation of queued jobs
                try:
                    rq_id = getattr(enq_job, 'id', None)
                    if rq_id:
                        job_ref = db.query(ScanJob).filter(ScanJob.id == job_id).first()
                        if job_ref:
                            job_ref.rq_job_id = rq_id
                            db.commit()
                            logger.info(f"scheduler_service._run_scheduled_job: persisted rq_job_id={rq_id} for job_id={job_id}")
                except Exception as e:
                    logger.warning(f"scheduler_service._run_scheduled_job: failed to persist rq_job_id for job_id={job_id}: {e}")

            # Enqueue batch alert job to run after all scans complete
            if send_alert and job_ids:
                # Enqueue a separate module-level function defined in backend.workers.batch_alert_task
                self.job_queue.enqueue(
                    send_batch_alert_after_completion_task,
                    scheduled_job_id,
                    job_ids,
                    sj.name,
                    now,
                    job_timeout=settings.JOB_TIMEOUT * 2  # Allow extra time for batch processing
                )
                logger.info(f"scheduler_service._run_scheduled_job: enqueued batch alert job for {len(job_ids)} scans")

            # After enqueuing, refresh APS next run time telemetry
            aps_job_id = self._aps_job_ids.get(str(sj.id))
            if aps_job_id and self.scheduler:
                aps_job = self.scheduler.get_job(aps_job_id)
                if aps_job:
                    self._update_next_run(str(sj.id), aps_job.next_run_time)

        finally:
            db.close()

    @staticmethod
    def _send_batch_alert_after_completion(
        scheduled_job_id: str,
        job_ids: List[str],
        scheduled_job_name: str,
        scan_date: datetime
    ) -> None:
        """
        Wait for all scan jobs to complete, then send aggregated batch alert.
        This runs as a separate RQ job.
        """
        import time
        from backend.models.settings import AppSettings
        
        db: Session = SessionLocal()
        try:
            # Poll for job completion (max 30 minutes)
            max_wait_seconds = 1800
            poll_interval = 10
            elapsed = 0
            
            logger.info(f"scheduler_service._send_batch_alert: waiting for {len(job_ids)} jobs to complete")
            
            while elapsed < max_wait_seconds:
                all_complete = True
                for job_id in job_ids:
                    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
                    if not job or job.status not in ['completed', 'failed', 'cancelled']:
                        all_complete = False
                        break
                
                if all_complete:
                    logger.info(f"scheduler_service._send_batch_alert: all jobs completed after {elapsed}s")
                    break
                
                time.sleep(poll_interval)
                elapsed += poll_interval
            
            if not all_complete:
                logger.warning(f"scheduler_service._send_batch_alert: timeout waiting for jobs to complete after {elapsed}s")
            
            # Collect results from all jobs
            results = BatchAlertService.collect_job_results(db, job_ids)
            
            # Get notification settings
            app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
            if not app_settings:
                logger.warning("scheduler_service._send_batch_alert: no app settings found")
                return
            
            # Get scheduled job to check which provider is enabled
            sj = db.query(ScheduledJob).filter(ScheduledJob.id == uuid.UUID(scheduled_job_id)).first()
            if not sj:
                logger.warning("scheduler_service._send_batch_alert: scheduled job not found")
                return
            
            # Determine provider from scheduled job flags
            provider = "none"
            if sj.notify_telegram:
                provider = "telegram"
            elif sj.notify_slack:
                provider = "slack"
            elif sj.notify_teams:
                provider = "teams"
            
            logger.info(f"scheduler_service._send_batch_alert: using provider '{provider}' for scheduled job '{scheduled_job_name}'")
            
            config = {
                "teams_webhook_url": app_settings.teams_webhook_url if app_settings else None,
                "slack_webhook_url": app_settings.slack_webhook_url if app_settings else None,
                "telegram_bot_token": app_settings.telegram_bot_token if app_settings else None,
                "telegram_chat_id": app_settings.telegram_chat_id if app_settings else None
            }
            
            # Construct dashboard URL (adjust based on your deployment)
            dashboard_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else "http://localhost:3000"
            
            # Send batch alert
            try:
                # Convert scan_date to local Asia/Jakarta for better UX in notifications
                try:
                    from zoneinfo import ZoneInfo
                    local_scan_date = scan_date.astimezone(ZoneInfo("Asia/Jakarta"))
                except Exception:
                    local_scan_date = scan_date

                # Diagnostic print for provider/config presence and results summary
                print(
                    "scheduler_service._send_batch_alert: "
                    f"provider={provider} "
                    f"cfg={{'teams': {bool(config.get('teams_webhook_url'))}, "
                    f"'slack': {bool(config.get('slack_webhook_url'))}, "
                    f"'telegram_token': {bool(config.get('telegram_bot_token'))}, "
                    f"'telegram_chat_id': {bool(config.get('telegram_chat_id'))}}} "
                    f"results_summary={{'queries_with_findings': {results.get('queries_with_findings')}, "
                    f"'total_credentials_found': {results.get('total_credentials_found')}}}"
                )

                success = BatchAlertService.send_batch_notification(
                    provider,
                    config,
                    scheduled_job_name,
                    local_scan_date,
                    results,
                    dashboard_url
                )
            except Exception as e:
                success = False
                logger.error(f"scheduler_service._send_batch_alert: exception while sending batch alert: {e}")
                print(f"scheduler_service._send_batch_alert: exception while sending batch alert: {e}")
            
            if success:
                logger.info(f"scheduler_service._send_batch_alert: batch alert sent successfully for scheduled job '{scheduled_job_name}'")
            else:
                logger.warning(f"scheduler_service._send_batch_alert: failed to send batch alert for scheduled job '{scheduled_job_name}'")
                
        except Exception as e:
            logger.error(f"scheduler_service._send_batch_alert: error sending batch alert: {e}")
        finally:
            db.close()

    def run_job_now(self, scheduled_job_id: str) -> None:
        """Manually trigger a ScheduledJob immediately."""
        # Fire the same path used by APS
        self._run_scheduled_job(scheduled_job_id)


# Note:
# The batch alert task is now provided by backend.workers.batch_alert_task.send_batch_alert_after_completion_task
# to avoid RQ serializing a bound class method that may contain non-serializable scheduler state.
# Ensure imports at top include:
# from backend.workers.batch_alert_task import send_batch_alert_after_completion_task

    def remove_job(self, scheduled_job_id: str) -> None:
        """Remove APS job and delete telemetry mapping."""
        aps_job_id = self._aps_job_ids.pop(scheduled_job_id, None)
        if aps_job_id:
            try:
                self.scheduler.remove_job(aps_job_id)
            except Exception:
                pass

    def _register_cve_auto_sync(self) -> None:
        """Register a daily CVE auto-sync job at 2 AM Jakarta time."""
        if not HAS_APSCHEDULER or not self.scheduler:
            return

        tz = ZoneInfo("Asia/Jakarta")
        # Run daily at 2:00 AM Jakarta time
        trigger = CronTrigger(hour=2, minute=0, timezone=tz)

        aps_job_id = "cve-auto-sync"

        # Remove existing job if present
        existing = self.scheduler.get_job(aps_job_id)
        if existing:
            self.scheduler.remove_job(aps_job_id)

        self.scheduler.add_job(
            self._run_cve_auto_sync,
            trigger=trigger,
            id=aps_job_id,
            replace_existing=True,
            misfire_grace_time=3600,  # 1 hour grace
            coalesce=True,
            max_instances=1,
        )

        logger.info("CVE auto-sync job registered: daily at 2:00 AM Jakarta time")

    def _run_cve_auto_sync(self) -> None:
        """Execute CVE incremental sync."""
        from backend.services.cve_service import CVEService
        from backend.models.settings import AppSettings

        logger.info("Starting automatic CVE sync...")
        
        db: Session = SessionLocal()
        try:
            # Determine days to sync
            settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
            if settings and settings.last_cve_sync_at:
                last = settings.last_cve_sync_at
                now_utc = datetime.now(timezone.utc)
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                delta_days = max(1, (now_utc - last).days or 1)
                days = min(delta_days, 30)
            else:
                days = 1  # Default to 1 day if never synced

            # Fetch CVEs
            cves = CVEService.fetch_recent_cves(days=days, db=db)
            
            if not cves:
                logger.info("CVE auto-sync: No new CVEs fetched")
                return

            # Sync to database
            result = CVEService.sync_cves_to_db(db, cves)

            # Update last sync timestamp
            if not settings:
                settings = AppSettings(id=1)
                db.add(settings)
                db.commit()
                db.refresh(settings)
            
            settings.last_cve_sync_at = datetime.now(timezone.utc)
            db.commit()

            logger.info(
                f"CVE auto-sync complete: {result['created']} created, "
                f"{result['updated']} updated, total fetched: {len(cves)}"
            )

        except Exception as e:
            logger.error(f"CVE auto-sync failed: {e}")
            db.rollback()
        finally:
            db.close()


# Module-level singleton
_scheduler_service: Optional[SchedulerService] = None


def get_scheduler_service() -> SchedulerService:
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService()
    return _scheduler_service