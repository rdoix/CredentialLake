"""Credential results routes with filters, pagination, and job association"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List
from datetime import datetime

from backend.database import get_db
from backend.models.credential import Credential
from backend.models.scan_job import ScanJob, JobCredential
from backend.models.schemas import PaginatedResponse, CredentialResponse
from backend.routes.auth import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/api/results", tags=["results"])


def paginate(query, page: int, page_size: int):
    """Utility to paginate SQLAlchemy query"""
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    return total, items, total_pages


@router.get("/", response_model=PaginatedResponse)
def list_credentials(
    db: Session = Depends(get_db),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    admin_only: bool = Query(False, description="Only admin credentials"),
    search: Optional[str] = Query(None, description="Search in URL/Username"),
    from_date: Optional[str] = Query(None, description="Filter by first_seen from (ISO date)"),
    to_date: Optional[str] = Query(None, description="Filter by last_seen to (ISO date)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user)
):
    """List credentials with filters and pagination"""
    query = db.query(Credential)
    
    # Filters
    if domain:
        # Include exact root and any subdomain suffix (*.root)
        query = query.filter(or_(Credential.domain == domain, Credential.domain.ilike(f"%.{domain}")))
    if admin_only:
        query = query.filter(Credential.is_admin == True)
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(Credential.url.ilike(pattern), Credential.username.ilike(pattern)))
    if from_date:
        try:
            dt = datetime.fromisoformat(from_date)
            query = query.filter(Credential.first_seen >= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format. Use ISO format.")
    if to_date:
        try:
            dt = datetime.fromisoformat(to_date)
            query = query.filter(Credential.last_seen <= dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format. Use ISO format.")
    
    # Sort by last_seen desc for freshness
    query = query.order_by(Credential.last_seen.desc())
    
    total, items, total_pages = paginate(query, page, page_size)
    
    return {
        "items": [c.to_dict() for c in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/job/{job_id}", response_model=PaginatedResponse)
def list_job_credentials(
    job_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    admin_only: bool = Query(False, description="Only admin credentials"),
    current_user: User = Depends(get_current_user)
):
    """List credentials associated with a specific job (robust against SQLAlchemy Row/tuple variations)."""
    # Validate job exists
    job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # First collect associated credential IDs and is_new flags from the join table
    assoc_rows = db.query(JobCredential.credential_id, JobCredential.is_new).filter(JobCredential.job_id == job_id).all()
    id_to_new: dict[int, bool] = {}
    ids: list[int] = []
    for cid, is_new in assoc_rows:
        # Normalize to int for mapping
        try:
            cid_int = int(cid)
        except Exception:
            # If UUID or other, skip safely
            continue
        ids.append(cid_int)
        try:
            id_to_new[cid_int] = bool(is_new)
        except Exception:
            id_to_new[cid_int] = bool(is_new)

    # If no associated credentials, return empty payload
    if len(ids) == 0:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }

    # Query Credential models by IDs, with optional admin filter
    query = db.query(Credential).filter(Credential.id.in_(ids))
    if admin_only:
        query = query.filter(Credential.is_admin == True)
    query = query.order_by(Credential.last_seen.desc())

    total, items, total_pages = paginate(query, page, page_size)

    # Build response items by merging is_new flags
    payload_items = []
    for cred in items:
        d = cred.to_dict()
        try:
            d["is_new"] = bool(id_to_new.get(int(cred.id), False))
        except Exception:
            d["is_new"] = bool(id_to_new.get(cred.id, False))
        payload_items.append(d)

    return {
        "items": payload_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/batch/{batch_id}", response_model=PaginatedResponse)
def list_batch_credentials(
    batch_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    admin_only: bool = Query(False, description="Only admin credentials"),
    current_user: User = Depends(get_current_user)
):
    """
    List credentials associated with all jobs in a batch.
    Aggregates credentials from all jobs sharing the same batch_id.
    """
    # Find all jobs with this batch_id
    jobs = db.query(ScanJob).filter(ScanJob.batch_id == batch_id).all()
    if not jobs:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    job_ids = [str(job.id) for job in jobs]
    
    # Collect all credential IDs and is_new flags from all jobs in the batch
    assoc_rows = db.query(JobCredential.credential_id, JobCredential.is_new).filter(
        JobCredential.job_id.in_(job_ids)
    ).all()
    
    id_to_new: dict[int, bool] = {}
    ids: list[int] = []
    for cid, is_new in assoc_rows:
        try:
            cid_int = int(cid)
        except Exception:
            continue
        
        # If credential appears in multiple jobs, mark as new if ANY job found it new
        if cid_int not in id_to_new:
            ids.append(cid_int)
            id_to_new[cid_int] = bool(is_new)
        else:
            # Keep as new if either occurrence was new
            id_to_new[cid_int] = id_to_new[cid_int] or bool(is_new)
    
    # If no credentials, return empty
    if len(ids) == 0:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        }
    
    # Query credentials with optional admin filter
    query = db.query(Credential).filter(Credential.id.in_(ids))
    if admin_only:
        query = query.filter(Credential.is_admin == True)
    query = query.order_by(Credential.last_seen.desc())
    
    total, items, total_pages = paginate(query, page, page_size)
    
    # Build response with is_new flags
    payload_items = []
    for cred in items:
        d = cred.to_dict()
        try:
            d["is_new"] = bool(id_to_new.get(int(cred.id), False))
        except Exception:
            d["is_new"] = bool(id_to_new.get(cred.id, False))
        payload_items.append(d)
    
    return {
        "items": payload_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }