"""Scheduler API routes for creating/listing/deleting/run-now of recurring IntelX scans."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import uuid
import logging
from datetime import timezone

from backend.database import get_db
from backend.models.scheduled_job import ScheduledJob
from backend.models.scan_job import ScanJob
from backend.models.schemas import (
    ScheduledJobRequest,
    ScheduledJobResponse,
    TimeFilter,
)
from backend.services.scheduler_service import get_scheduler_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])

# Ensure datetimes are emitted as timezone-aware UTC for UI correctness
def _ensure_utc(dt):
    if dt is None:
        return None
    # If naive, assume UTC and attach tzinfo
    if getattr(dt, 'tzinfo', None) is None:
        try:
            return dt.replace(tzinfo=timezone.utc)
        except Exception:
            return dt
    # If aware, convert to UTC
    try:
        return dt.astimezone(timezone.utc)
    except Exception:
        return dt

def _to_response(sj: ScheduledJob, db: Session = None) -> ScheduledJobResponse:
    """Map ORM ScheduledJob -> API ScheduledJobResponse (normalize UUID and keywords list)."""
    # Normalize keywords to list
    keywords_list = sj.get_keywords_list() if hasattr(sj, "get_keywords_list") else []
    # Normalize time_filter to enum where possible; default to D1 if invalid
    tf_code = sj.time_filter or "D1"
    try:
        tf_enum = TimeFilter(tf_code)
    except Exception:
        tf_enum = TimeFilter.D1
    
    # Calculate stats from scan_jobs if db session provided
    total_runs = 0
    successful_runs = 0
    last_credentials = 0
    
    if db:
        # Count jobs created by this scheduled job (match by name pattern or query containing keywords)
        keywords_list_lower = [k.lower() for k in keywords_list]
        total_runs = db.query(func.count(ScanJob.id)).filter(
            and_(
                ScanJob.job_type == 'intelx_single',
                ScanJob.name.ilike(f"%{sj.name}%")
            )
        ).scalar() or 0
        
        successful_runs = db.query(func.count(ScanJob.id)).filter(
            and_(
                ScanJob.job_type == 'intelx_single',
                ScanJob.name.ilike(f"%{sj.name}%"),
                ScanJob.status == 'completed'
            )
        ).scalar() or 0
        
        # Get last run's credential count
        last_job = db.query(ScanJob).filter(
            and_(
                ScanJob.job_type == 'intelx_single',
                ScanJob.name.ilike(f"%{sj.name}%"),
                ScanJob.status == 'completed'
            )
        ).order_by(ScanJob.completed_at.desc()).first()
        
        if last_job:
            last_credentials = last_job.total_parsed or 0
    
    return ScheduledJobResponse(
        id=str(sj.id),
        name=sj.name,
        keywords=keywords_list,
        time_filter=tf_enum,
        schedule=sj.schedule,
        timezone=sj.timezone,
        notify_telegram=bool(sj.notify_telegram),
        notify_slack=bool(sj.notify_slack),
        notify_teams=bool(sj.notify_teams),
        is_active=bool(sj.is_active),
        # Emit timezone-aware UTC datetimes so FastAPI serializes with +00:00
        last_run=_ensure_utc(sj.last_run),
        next_run=_ensure_utc(sj.next_run),
        created_at=_ensure_utc(sj.created_at),
        updated_at=_ensure_utc(sj.updated_at),
        total_runs=total_runs,
        successful_runs=successful_runs,
        last_credentials=last_credentials,
    )


@router.get("/jobs", response_model=list[ScheduledJobResponse])
def list_scheduled_jobs(db: Session = Depends(get_db)):
    """List all scheduled jobs with stats."""
    jobs = db.query(ScheduledJob).order_by(ScheduledJob.created_at.desc()).all()
    return [_to_response(j, db) for j in jobs]


@router.post("/jobs", response_model=ScheduledJobResponse)
def create_scheduled_job(req: ScheduledJobRequest, db: Session = Depends(get_db)):
    """
    Create a scheduled job:
    - name, keywords (list), time_filter (D1/D7/D30 default D1)
    - schedule (cron string), timezone (default Asia/Jakarta)
    - notifications flags
    - run_immediately: trigger a run after creation
    """
    # Normalize keywords to comma-separated
    keywords_csv = ",".join(req.keywords)

    sj = ScheduledJob(
        name=req.name,
        keywords=keywords_csv,
        time_filter=req.time_filter.value if req.time_filter else "D1",
        schedule=req.schedule,
        timezone=req.timezone or "Asia/Jakarta",
        notify_telegram=req.notify_telegram,
        notify_slack=req.notify_slack,
        notify_teams=req.notify_teams,
        is_active=True,
    )
    db.add(sj)
    db.commit()
    db.refresh(sj)

    # Register APS trigger
    svc = get_scheduler_service()
    try:
        svc.start()  # idempotent start
        svc._register_aps_job(sj)
    except Exception as e:
        logger.warning(f"scheduler.create_scheduled_job: scheduler setup failed: {e}")

    # Optionally fire immediately
    if req.run_immediately:
        try:
            svc.run_job_now(str(sj.id))
        except Exception as e:
            logger.warning(f"scheduler.create_scheduled_job: run_now failed for id={sj.id}: {e}")

    # Re-fetch the job to ensure next_run/last_run telemetry set by SchedulerService is included in the response
    sj = db.query(ScheduledJob).filter(ScheduledJob.id == sj.id).first()

    return _to_response(sj, db)


@router.put("/jobs/{job_id}", response_model=ScheduledJobResponse)
def update_scheduled_job(job_id: str, req: ScheduledJobRequest, db: Session = Depends(get_db)):
    """
    Update an existing scheduled job:
    - name, keywords (list), time_filter (D1/D7/D30)
    - schedule (cron string), timezone
    - notifications flags
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    # Update fields
    sj.name = req.name
    sj.keywords = ",".join(req.keywords)
    sj.time_filter = req.time_filter.value if req.time_filter else "D1"
    sj.schedule = req.schedule
    sj.timezone = req.timezone or "Asia/Jakarta"
    sj.notify_telegram = req.notify_telegram
    sj.notify_slack = req.notify_slack
    sj.notify_teams = req.notify_teams

    db.commit()
    db.refresh(sj)

    # Re-register APS trigger if job is active
    if sj.is_active:
        svc = get_scheduler_service()
        try:
            svc.start()  # idempotent start
            svc._register_aps_job(sj)
        except Exception as e:
            logger.warning(f"scheduler.update_scheduled_job: scheduler setup failed: {e}")

    # Re-fetch the job to ensure next_run reflects updated schedule
    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()

    return _to_response(sj, db)


@router.delete("/jobs/{job_id}")
def delete_scheduled_job(job_id: str, db: Session = Depends(get_db)):
    """Delete a scheduled job and remove APS trigger."""
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    svc = get_scheduler_service()
    svc.remove_job(str(sj.id))

    db.delete(sj)
    db.commit()
    return {"status": "deleted", "id": job_id}


@router.post("/jobs/{job_id}/run-now")
def run_scheduled_job_now(job_id: str):
    """Trigger a scheduled job immediately (enqueue scans for its keywords)."""
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    svc = get_scheduler_service()
    svc.run_job_now(job_id)
    return {"status": "queued", "id": job_id}


@router.post("/jobs/{job_id}/pause", response_model=ScheduledJobResponse)
def pause_scheduled_job(job_id: str, db: Session = Depends(get_db)):
    """
    Pause a scheduled job:
    - Set is_active=False
    - Remove APS trigger
    - Clear next_run telemetry
    - Return updated ScheduledJobResponse
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    # Flip active flag
    if sj.is_active:
        sj.is_active = False
        db.commit()

    # Remove APS job and clear next_run
    svc = get_scheduler_service()
    try:
        svc.remove_job(str(sj.id))
    except Exception as e:
        logger.warning(f"scheduler.pause_scheduled_job: APS remove failed for id={sj.id}: {e}")

    # Ensure telemetry cleared
    sj.next_run = None
    db.commit()

    # Re-fetch for response consistency
    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    return _to_response(sj, db)


@router.post("/jobs/{job_id}/resume", response_model=ScheduledJobResponse)
def resume_scheduled_job(job_id: str, db: Session = Depends(get_db)):
    """
    Resume a scheduled job:
    - Set is_active=True
    - Start scheduler (idempotent) and re-register APS trigger
    - Update next_run telemetry
    - Return updated ScheduledJobResponse
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    # Flip active flag
    if not sj.is_active:
        sj.is_active = True
        db.commit()

    svc = get_scheduler_service()
    try:
        svc.start()  # idempotent
        svc._register_aps_job(sj)
    except Exception as e:
        logger.warning(f"scheduler.resume_scheduled_job: APS register failed for id={sj.id}: {e}")

    # Re-fetch so next_run reflects APS telemetry
    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    return _to_response(sj, db)


@router.get("/jobs/{job_id}/history")
def get_scheduled_job_history(job_id: str, db: Session = Depends(get_db)):
    """Get run history for a scheduled job (last 20 runs)."""
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")
    
    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Scheduled job not found")
    
    # Find scan jobs created by this scheduled job
    history = db.query(ScanJob).filter(
        and_(
            ScanJob.job_type == 'intelx_single',
            ScanJob.name.ilike(f"%{sj.name}%")
        )
    ).order_by(ScanJob.created_at.desc()).limit(20).all()
    
    return {
        "scheduled_job_id": job_id,
        "scheduled_job_name": sj.name,
        "history": [job.to_dict() for job in history]
    }

@router.get("/jobs/{job_id}/next-run")
def get_next_run(job_id: str, db: Session = Depends(get_db)):
    """
    Return the next run time for a scheduled job from both DB telemetry and APScheduler.
    Helps verify the job will trigger at the upcoming schedule.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")
    
    sj = db.query(ScheduledJob).filter(ScheduledJob.id == job_uuid).first()
    if not sj:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    svc = get_scheduler_service()
    aps_next_run = None
    scheduler_running = False

    try:
        scheduler_running = bool(svc.scheduler and svc.scheduler.running)
        if scheduler_running:
            aps_job_id = svc._aps_job_ids.get(str(sj.id))
            if aps_job_id and svc.scheduler:
                aps_job = svc.scheduler.get_job(aps_job_id)
                aps_next_run = aps_job.next_run_time if aps_job else None
    except Exception as e:
        # Log only; return DB telemetry regardless
        logger = logging.getLogger(__name__)
        logger.warning(f"scheduler.get_next_run: APS read failed for id={sj.id}: {e}")

    return {
        "scheduled_job_id": job_id,
        "name": sj.name,
        "db_next_run": sj.next_run,
        "aps_next_run": aps_next_run,
        "scheduler_running": scheduler_running,
        "timezone": sj.timezone,
        "schedule": sj.schedule,
    }