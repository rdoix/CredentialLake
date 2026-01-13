"""Job management routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend.models.scan_job import ScanJob
from backend.models.schemas import JobResponse
from backend.config import settings
from backend.routes.auth import get_current_user, require_collector_or_admin
from backend.models.user import User

# RQ/Redis imports for queue interaction
from redis import Redis
from rq import Queue
from rq.job import Job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/", response_model=List[JobResponse])
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None, description="Filter by status: queued|running|completed|failed|collecting|parsing|upserting|cancelling|cancelled"),
    grouped: bool = Query(False, description="Group jobs by batch_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all scan jobs with optional filtering and grouping.
    When grouped=true, jobs with the same batch_id are combined into a single entry.
    """
    query = db.query(ScanJob)
    if status:
        query = query.filter(ScanJob.status == status)
    jobs = query.order_by(ScanJob.created_at.desc()).offset(skip).limit(limit).all()
    
    if not grouped:
        return [job.to_dict() for job in jobs]
    
    # Group jobs by batch_id
    from collections import defaultdict
    batches = defaultdict(list)
    standalone_jobs = []
    
    for job in jobs:
        if job.batch_id:
            batches[str(job.batch_id)].append(job)
        else:
            standalone_jobs.append(job)
    
    # Create grouped responses
    result = []
    
    # Add grouped jobs (combine stats from all jobs in batch)
    for batch_id, batch_jobs in batches.items():
        # Use the first job as the base
        base_job = batch_jobs[0]
        grouped_dict = base_job.to_dict()
        
        # For grouped jobs, use the job name (scheduled job name) as the query/target
        # instead of individual keyword
        if base_job.name:
            grouped_dict['query'] = base_job.name
        
        # Aggregate statistics from all jobs in the batch
        grouped_dict['batch_size'] = len(batch_jobs)
        grouped_dict['batch_queries'] = [j.query for j in batch_jobs]
        grouped_dict['total_raw'] = sum(j.total_raw or 0 for j in batch_jobs)
        grouped_dict['total_parsed'] = sum(j.total_parsed or 0 for j in batch_jobs)
        grouped_dict['total_new'] = sum(j.total_new or 0 for j in batch_jobs)
        grouped_dict['total_duplicates'] = sum(j.total_duplicates or 0 for j in batch_jobs)
        
        # Determine overall status (prioritize: running > failed > completed)
        statuses = [j.status for j in batch_jobs]
        if any(s in ['running', 'collecting', 'parsing', 'upserting'] for s in statuses):
            grouped_dict['status'] = 'running'
        elif any(s == 'failed' for s in statuses):
            grouped_dict['status'] = 'failed'
        elif all(s == 'completed' for s in statuses):
            grouped_dict['status'] = 'completed'
        elif any(s == 'queued' for s in statuses):
            grouped_dict['status'] = 'queued'
        else:
            grouped_dict['status'] = base_job.status
        
        # Use earliest started_at and latest completed_at
        started_times = [j.started_at for j in batch_jobs if j.started_at]
        completed_times = [j.completed_at for j in batch_jobs if j.completed_at]
        if started_times:
            grouped_dict['started_at'] = min(started_times).isoformat() + 'Z'
        if completed_times:
            grouped_dict['completed_at'] = max(completed_times).isoformat() + 'Z'
        
        result.append(grouped_dict)
    
    # Fallback grouping for legacy jobs without batch_id:
    # Group intelx_single jobs by (name, time bucket ~60 minutes, time_filter)
    # so older runs created before batch_id was added are combined into one entry.
    from collections import defaultdict
    
    legacy_groups = defaultdict(list)
    leftovers = []
    
    def _time_bucket(dt: datetime | None):
        """
        Round a datetime down to a 60-minute bucket (top of the hour). If none provided, return None.
        """
        if not dt:
            return None
        try:
            return dt.replace(minute=0, second=0, microsecond=0)
        except Exception:
            return dt
    
    for job in standalone_jobs:
        # Only group intelx_single jobs that have a 'name' (i.e., created by a ScheduledJob)
        # Manual single scans typically lack a schedule name and should remain standalone.
        if job.job_type == 'intelx_single' and job.name:
            # Prefer created_at; fallback to started_at; then completed_at
            base_ts = job.created_at or job.started_at or job.completed_at
            bucket = _time_bucket(base_ts)
            key = (
                job.name,
                bucket.isoformat() if bucket else 'no-time',
                job.time_filter or '',
            )
            legacy_groups[key].append(job)
        else:
            leftovers.append(job)
    
    # Convert grouped legacy entries into aggregated responses
    for (_name, _bucket_iso, _tf), batch_jobs in legacy_groups.items():
        if len(batch_jobs) <= 1:
            # Singletons remain as individual entries
            leftovers.extend(batch_jobs)
            continue
        
        base_job = batch_jobs[0]
        grouped_dict = base_job.to_dict()
        
        # For legacy grouped jobs, use the job name (scheduled job name) as the query/target
        if base_job.name:
            grouped_dict['query'] = base_job.name
        
        # Aggregated fields matching batch_id grouping contract
        grouped_dict['batch_size'] = len(batch_jobs)
        grouped_dict['batch_queries'] = [j.query for j in batch_jobs]
        grouped_dict['total_raw'] = sum(j.total_raw or 0 for j in batch_jobs)
        grouped_dict['total_parsed'] = sum(j.total_parsed or 0 for j in batch_jobs)
        grouped_dict['total_new'] = sum(j.total_new or 0 for j in batch_jobs)
        grouped_dict['total_duplicates'] = sum(j.total_duplicates or 0 for j in batch_jobs)
        
        statuses = [j.status for j in batch_jobs]
        if any(s in ['running', 'collecting', 'parsing', 'upserting'] for s in statuses):
            grouped_dict['status'] = 'running'
        elif any(s == 'failed' for s in statuses):
            grouped_dict['status'] = 'failed'
        elif all(s == 'completed' for s in statuses):
            grouped_dict['status'] = 'completed'
        elif any(s == 'queued' for s in statuses):
            grouped_dict['status'] = 'queued'
        else:
            grouped_dict['status'] = base_job.status
        
        started_times = [j.started_at for j in batch_jobs if j.started_at]
        completed_times = [j.completed_at for j in batch_jobs if j.completed_at]
        if started_times:
            grouped_dict['started_at'] = min(started_times).isoformat() + 'Z'
        if completed_times:
            grouped_dict['completed_at'] = max(completed_times).isoformat() + 'Z'
        
        result.append(grouped_dict)
    
    # Add any remaining standalone jobs (manual or non-groupable)
    result.extend([job.to_dict() for job in leftovers])
    
    return result


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get job details by ID"""
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@router.post("/{job_id}/cancel")
def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """
    Cancel a job if allowed.
    Policy:
    - Allowed: queued, collecting
    - Forbidden: parsing, upserting
    - Completed/failed/cancelled: no-op or 409 depending on preference
    """
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    non_cancellable = {"parsing", "upserting"}
    terminal = {"completed", "failed", "cancelled"}

    if job.status in non_cancellable:
        raise HTTPException(status_code=409, detail=f"Job in non-cancellable phase: {job.status}")

    if job.status in terminal:
        return {"message": "Job already finished", "job_id": job_id, "status": job.status}

    # Initialize Redis/RQ objects
    redis_conn = Redis.from_url(settings.REDIS_URL)
    job_queue = Queue(connection=redis_conn)

    # If queued with rq_job_id, attempt to remove/cancel in queue
    removed = False
    if job.status == "queued" and job.rq_job_id:
        try:
            rq_job = Job.fetch(job.rq_job_id, connection=redis_conn)
            # Try multiple strategies to remove queued job
            try:
                job_queue.remove(rq_job.id)  # may not exist in some RQ versions
                removed = True
            except Exception:
                try:
                    rq_job.cancel()  # supported in newer RQ
                    removed = True
                except Exception:
                    try:
                        rq_job.delete()
                        removed = True
                    except Exception:
                        removed = False
        except Exception:
            removed = False

        job.cancel_requested = True
        job.status = "cancelled"
        job.completed_at = datetime.now()
        db.commit()
        return {"message": "Job cancelled", "job_id": job_id, "removed_from_queue": removed}

    # For running/collecting (or legacy 'running'), request cooperative cancellation
    if job.status in {"running", "collecting"}:
        job.cancel_requested = True
        job.status = "cancelling"
        db.commit()
        return {"message": "Cancellation requested", "job_id": job_id, "status": job.status}

    # If status is something else (e.g., unknown), set cancel_requested and return
    job.cancel_requested = True
    db.commit()
    return {"message": "Cancellation requested", "job_id": job_id, "status": job.status}


@router.post("/{job_id}/pause")
def pause_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """
    Pause a running job.
    Policy:
    - Allowed: collecting
    - Forbidden: parsing, upserting, queued
    - Completed/failed/cancelled: no-op
    """
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    non_pausable = {"parsing", "upserting", "queued"}
    terminal = {"completed", "failed", "cancelled"}

    if job.status in non_pausable:
        raise HTTPException(status_code=409, detail=f"Job in non-pausable phase: {job.status}")

    if job.status in terminal:
        return {"message": "Job already finished", "job_id": job_id, "status": job.status}

    if job.status == "paused":
        return {"message": "Job already paused", "job_id": job_id, "status": job.status}

    # Only allow pausing during collecting phase
    if job.status == "collecting":
        job.pause_requested = True
        job.status = "paused"
        db.commit()
        return {"message": "Job paused", "job_id": job_id, "status": job.status}

    raise HTTPException(status_code=409, detail=f"Cannot pause job in status: {job.status}")


@router.post("/{job_id}/resume")
def resume_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """
    Resume a paused job.
    """
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "paused":
        raise HTTPException(status_code=409, detail=f"Job is not paused (current status: {job.status})")

    # Resume by clearing pause flag and returning to collecting
    job.pause_requested = False
    job.status = "collecting"
    db.commit()
    
    # Re-enqueue the job to continue processing
    from redis import Redis
    from rq import Queue
    from backend.workers.scan_worker import process_intelx_scan, process_multi_domain_scan, process_file_scan
    
    redis_conn = Redis.from_url(settings.REDIS_URL)
    job_queue = Queue(connection=redis_conn)
    
    # Determine which worker function to use based on job type
    if job.job_type == "intelx_single":
        # Re-enqueue with original parameters (stored in query)
        rq_job = job_queue.enqueue(
            process_intelx_scan,
            str(job.id),   # job_id (positional)
            job.query,     # query
            1000,          # max_results default to SingleScan behavior
            "",            # time_filter (not stored; resume with none)
            50,            # display limit
            False,         # send_alert
            job_timeout=settings.JOB_TIMEOUT
        )
        job.rq_job_id = rq_job.id
    elif job.job_type == "intelx_multi":
        # Parse domains from query (assuming comma-separated)
        domains = [d.strip() for d in job.query.split(',')]
        rq_job = job_queue.enqueue(
            process_multi_domain_scan,
            str(job.id),   # job_id (positional)
            domains,       # domains list
            1000,          # max_results default
            "",            # time_filter
            50,            # display limit
            False,         # send_alert
            job_timeout=settings.JOB_TIMEOUT
        )
        job.rq_job_id = rq_job.id
    elif job.job_type == "file":
        # For file scans, we'd need to store the file path
        raise HTTPException(status_code=501, detail="Resume not yet supported for file scans")
    
    db.commit()
    return {"message": "Job resumed", "job_id": job_id, "status": job.status}


@router.delete("/{job_id}")
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Delete a specific job"""
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete related job_credentials entries first
    from backend.models.scan_job import JobCredential
    db.query(JobCredential).filter(JobCredential.job_id == job_id).delete()

    # Now delete the job
    db.delete(job)
    db.commit()
    return {"message": "Job deleted successfully", "job_id": job_id}


@router.delete("/")
def clear_all_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Clear all jobs from database"""
    from backend.models.scan_job import JobCredential

    # Delete all job_credentials first
    db.query(JobCredential).delete()

    # Then delete all jobs
    count = db.query(ScanJob).delete()
    db.commit()
    return {"message": f"Deleted {count} jobs successfully", "deleted_count": count}