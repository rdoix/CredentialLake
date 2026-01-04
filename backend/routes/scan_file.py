"""File scan routes"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from redis import Redis
from rq import Queue
import uuid
import tempfile
import os
from typing import Optional

from backend.database import get_db
from backend.models.scan_job import ScanJob
from backend.models.schemas import JobCreateResponse
from backend.config import settings
from backend.workers.scan_worker import process_file_scan
from backend.routes.auth import require_collector_or_admin
from backend.models.user import User

router = APIRouter(prefix="/api/scan/file", tags=["file-scan"])

# Redis connection for job queue
redis_conn = Redis.from_url(settings.REDIS_URL)
job_queue = Queue(connection=redis_conn)


@router.post("/", response_model=JobCreateResponse)
async def create_file_scan(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    query: Optional[str] = Form(None),
    send_alert: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Create a new file scan job"""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    try:
        size = len(content) if content is not None else 0
    except Exception:
        size = -1
    print(f"scan_file.create_file_scan: saved upload filename={file.filename} tmp_path={tmp_path} size={size}")
    
    # Create job record
    job_id = str(uuid.uuid4())
    job = ScanJob(
        id=job_id,
        job_type='file',
        name=name,
        query=query or file.filename,
        status='queued'
    )
    db.add(job)
    db.commit()
    print(f"scan_file.create_file_scan: job created job_id={job_id} name={name} query={query or file.filename}")
    
    # Enqueue background task
    print(f"scan_file.create_file_scan: enqueue start job_id={job_id} tmp_path={tmp_path}")
    enq_job = job_queue.enqueue(
        process_file_scan,
        job_id=job_id,
        file_path=tmp_path,
        query=query,
        send_alert=send_alert,
        job_timeout=settings.JOB_TIMEOUT
    )
    try:
        rq_id = getattr(enq_job, 'id', None)
        print(f"scan_file.create_file_scan: enqueued rq_job_id={rq_id} for job_id={job_id}")
        # Persist RQ job id for cancellation of queued jobs
        job_ref = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job_ref and rq_id:
            job_ref.rq_job_id = rq_id
            db.commit()
            print(f"scan_file.create_file_scan: persisted rq_job_id={rq_id} to job_id={job_id}")
    except Exception:
        print(f"scan_file.create_file_scan: enqueued (no rq id available) for job_id={job_id}")
    
    return JobCreateResponse(
        job_id=job_id,
        status='queued',
        message=f'File scan job created for: {file.filename}'
    )