"""APScheduler-backed service to trigger IntelX scans on a cron schedule.

This service:
- Loads persisted jobs from DB (ScheduledJob) on startup
- Registers Cron triggers in Asia/Jakarta (or per-job timezone)
- Enqueues RQ jobs to run [process_intelx_scan()](backend/workers/scan_worker.py:22) for each keyword
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
from backend.workers.scan_worker import process_intelx_scan

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
        """Start APScheduler and register all active ScheduledJob entries."""
        if not HAS_APSCHEDULER:
            # No scheduler available; still allow manual run-now via API
            return

        if not self.scheduler.running:
            self.scheduler.start()

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
            display_limit = 10

            for kw in keywords:
                # Create a ScanJob row to track execution
                job_id = str(uuid.uuid4())
                job_row = ScanJob(
                    id=job_id,
                    job_type="intelx_single",
                    name=sj.name,
                    query=kw,
                    time_filter=sj.time_filter or "D1",
                    status="queued",
                )
                db.add(job_row)
                db.commit()

                # Enqueue the actual worker task
                enq_job = self.job_queue.enqueue(
                    process_intelx_scan,
                    job_id,
                    kw,
                    max_results,
                    sj.time_filter or "D1",
                    display_limit,
                    send_alert,
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

            # After enqueuing, refresh APS next run time telemetry
            aps_job_id = self._aps_job_ids.get(str(sj.id))
            if aps_job_id and self.scheduler:
                aps_job = self.scheduler.get_job(aps_job_id)
                if aps_job:
                    self._update_next_run(str(sj.id), aps_job.next_run_time)

        finally:
            db.close()

    def run_job_now(self, scheduled_job_id: str) -> None:
        """Manually trigger a ScheduledJob immediately."""
        # Fire the same path used by APS
        self._run_scheduled_job(scheduled_job_id)

    def remove_job(self, scheduled_job_id: str) -> None:
        """Remove APS job and delete telemetry mapping."""
        aps_job_id = self._aps_job_ids.pop(scheduled_job_id, None)
        if aps_job_id:
            try:
                self.scheduler.remove_job(aps_job_id)
            except Exception:
                pass


# Module-level singleton
_scheduler_service: Optional[SchedulerService] = None


def get_scheduler_service() -> SchedulerService:
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService()
    return _scheduler_service