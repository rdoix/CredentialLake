"""IntelX scan routes"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from redis import Redis
from rq import Queue
import uuid
from datetime import datetime
import tempfile
import os

from backend.database import get_db
from backend.models.scan_job import ScanJob
from backend.models.schemas import (
    IntelXScanRequest,
    IntelXMultiScanRequest,
    JobCreateResponse
)
from backend.config import settings
from backend.workers.scan_worker import process_intelx_scan, process_multi_domain_scan
from backend.routes.auth import require_collector_or_admin
from backend.models.user import User

router = APIRouter(prefix="/api/scan/intelx", tags=["intelx-scan"])

# Redis connection for job queue
redis_conn = Redis.from_url(settings.REDIS_URL)
job_queue = Queue(connection=redis_conn)


@router.post("/single", response_model=JobCreateResponse)
def create_intelx_scan(
    request: IntelXScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Create a new single domain/email IntelX scan job"""
    # Create job record
    job_id = str(uuid.uuid4())
    job = ScanJob(
        id=job_id,
        job_type='intelx_single',
        name=request.name,
        query=request.query,
        time_filter=(request.time_filter.value if request.time_filter else None),
        status='queued'
    )
    db.add(job)
    db.commit()
    
    # Enqueue background task
    enq_job = job_queue.enqueue(
        process_intelx_scan,
        job_id,
        request.query,
        request.max_results,
        request.time_filter.value if request.time_filter else None,
        request.display_limit,
        request.send_alert,
        job_timeout=settings.JOB_TIMEOUT
    )
    # Persist RQ job id for cancellation of queued jobs
    try:
        rq_id = getattr(enq_job, 'id', None)
        if rq_id:
            job_ref = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job_ref:
                job_ref.rq_job_id = rq_id
                db.commit()
                print(f"scan_intelx.create_intelx_scan: persisted rq_job_id={rq_id} to job_id={job_id}")
    except Exception as e:
        print(f"scan_intelx.create_intelx_scan: failed to persist rq_job_id for job_id={job_id} err={e}")
    
    return JobCreateResponse(
        job_id=job_id,
        status='queued',
        message=f'IntelX scan job created for query: {request.query}'
    )


@router.post("/multiple", response_model=JobCreateResponse)
def create_multi_domain_scan(
    request: IntelXMultiScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Create a new multiple domain IntelX scan job"""
    # Create job record
    job_id = str(uuid.uuid4())
    job = ScanJob(
        id=job_id,
        job_type='intelx_multi',
        name=request.name,
        query=f"Multiple domains ({len(request.domains)} domains)",
        time_filter=(request.time_filter.value if request.time_filter else None),
        status='queued'
    )
    db.add(job)
    db.commit()
    
    # Enqueue background task
    enq_job = job_queue.enqueue(
        process_multi_domain_scan,
        job_id,
        request.domains,
        request.max_results,
        request.time_filter.value if request.time_filter else None,
        request.display_limit,
        request.send_alert,
        job_timeout=settings.JOB_TIMEOUT
    )
    # Persist RQ job id for cancellation of queued jobs
    try:
        rq_id = getattr(enq_job, 'id', None)
        if rq_id:
            job_ref = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job_ref:
                job_ref.rq_job_id = rq_id
                db.commit()
                print(f"scan_intelx.create_multi_domain_scan: persisted rq_job_id={rq_id} to job_id={job_id}")
    except Exception as e:
        print(f"scan_intelx.create_multi_domain_scan: failed to persist rq_job_id for job_id={job_id} err={e}")
    
    return JobCreateResponse(
        job_id=job_id,
        status='queued',
        message=f'Multi-domain scan job created for {len(request.domains)} domains'
    )


@router.post("/multiple-file", response_model=JobCreateResponse)
async def create_multi_domain_scan_from_file(
    file: UploadFile = File(...),
    name: str = Form(None),
    time_filter: str = Form(None),
    max_results: int = Form(100),
    display_limit: int = Form(10),
    send_alert: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Create a new multiple domain scan from uploaded file"""
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Read domains from file
        with open(tmp_path, 'r') as f:
            domains = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        
        if not domains:
            raise HTTPException(status_code=400, detail="No domains found in file")
        
        # Create job record
        job_id = str(uuid.uuid4())
        job = ScanJob(
            id=job_id,
            job_type='intelx_multi',
            name=name,
            query=f"Multiple domains from file ({len(domains)} domains)",
            time_filter=time_filter,
            status='queued'
        )
        db.add(job)
        db.commit()
        
        # Enqueue background task
        enq_job = job_queue.enqueue(
            process_multi_domain_scan,
            job_id,
            domains,
            max_results,
            time_filter,
            display_limit,
            send_alert,
            job_timeout=settings.JOB_TIMEOUT
        )
        # Persist RQ job id for cancellation of queued jobs
        try:
            rq_id = getattr(enq_job, 'id', None)
            if rq_id:
                job_ref = db.query(ScanJob).filter(ScanJob.id == job_id).first()
                if job_ref:
                    job_ref.rq_job_id = rq_id
                    db.commit()
                    print(f"scan_intelx.create_multi_domain_scan_from_file: persisted rq_job_id={rq_id} to job_id={job_id}")
        except Exception as e:
            print(f"scan_intelx.create_multi_domain_scan_from_file: failed to persist rq_job_id for job_id={job_id} err={e}")
        
        return JobCreateResponse(
            job_id=job_id,
            status='queued',
            message=f'Multi-domain scan job created for {len(domains)} domains from file'
        )
    
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)