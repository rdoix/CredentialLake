"""Credentials management routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional

from backend.database import get_db
from backend.models.credential import Credential
from backend.models.scan_job import JobCredential
from backend.routes.auth import get_current_user, require_collector_or_admin
from backend.models.user import User

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get("/")
def list_credentials(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    is_admin: Optional[bool] = Query(None, description="Filter by admin status"),
    search: Optional[str] = Query(None, description="Search by email/domain"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all credentials with optional filtering and pagination"""
    query = db.query(Credential)

    # Apply filters
    if domain:
        query = query.filter(Credential.domain.ilike(f"%{domain}%"))

    if is_admin is not None:
        query = query.filter(Credential.is_admin == is_admin)

    if search:
        query = query.filter(
            (Credential.username.ilike(f"%{search}%")) |
            (Credential.domain.ilike(f"%{search}%"))
        )

    # Get total count before pagination
    total = query.count()

    # Order by most recently seen
    credentials = query.order_by(desc(Credential.last_seen)).offset(skip).limit(limit).all()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "credentials": [cred.to_dict() for cred in credentials]
    }


@router.get("/stats")
def get_credential_stats(
    domain: Optional[str] = Query(None, description="Filter by domain"),
    search: Optional[str] = Query(None, description="Search by email/domain"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get credential statistics with optional filtering - optimized single query"""
    from sqlalchemy import case, or_, and_
    
    # Build base query with filters
    query = db.query(Credential)
    
    # Apply filters
    if domain:
        query = query.filter(Credential.domain.ilike(f"%{domain}%"))
    
    if search:
        query = query.filter(
            or_(
                Credential.username.ilike(f"%{search}%"),
                Credential.domain.ilike(f"%{search}%")
            )
        )
    
    # Single aggregated query for all stats
    stats_query = query.with_entities(
        func.count(Credential.id).label('total'),
        func.sum(case((Credential.is_admin == True, 1), else_=0)).label('admin'),
        func.sum(case((Credential.seen_count > 1, 1), else_=0)).label('verified'),
        func.sum(case((func.length(Credential.password) < 8, 1), else_=0)).label('weak'),
        func.sum(
            case(
                (and_(func.length(Credential.password) >= 8, func.length(Credential.password) < 12), 1),
                else_=0
            )
        ).label('medium'),
        func.count(func.distinct(Credential.domain)).label('unique_domains')
    ).first()
    
    total = stats_query.total or 0
    admin_count = stats_query.admin or 0
    verified = stats_query.verified or 0
    weak_passwords = stats_query.weak or 0
    medium_passwords = stats_query.medium or 0
    strong_passwords = total - weak_passwords - medium_passwords
    unique_domains = stats_query.unique_domains or 0

    return {
        "total": total,
        "admin": admin_count,
        "verified": verified,
        "weak": weak_passwords,
        "medium": medium_passwords,
        "strong": strong_passwords,
        "unique_domains": unique_domains
    }


@router.get("/{credential_id}")
def get_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get credential details by ID"""
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    return credential.to_dict()


@router.delete("/{credential_id}")
def delete_credential(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Delete a specific credential and its job associations to satisfy FK constraints"""
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Delete job-credential associations first to avoid FOREIGN KEY constraint failure
    assoc_deleted = db.query(JobCredential).filter(JobCredential.credential_id == credential_id).delete()
    print(f"credentials.delete_credential: deleting credential_id={credential_id} assoc_deleted={assoc_deleted}")

    db.delete(credential)
    db.commit()
    return {"message": "Credential deleted successfully", "credential_id": credential_id, "deleted_associations": assoc_deleted}


@router.delete("/")
def clear_all_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_collector_or_admin)
):
    """Clear all credentials from database along with job associations to avoid FK constraint errors"""
    # Delete job-credential associations first to satisfy FK constraints
    assoc_deleted = db.query(JobCredential).delete()
    creds_deleted = db.query(Credential).delete()
    db.commit()
    return {
        "message": f"Deleted {creds_deleted} credentials and {assoc_deleted} job associations successfully",
        "deleted_count": creds_deleted,
        "deleted_associations": assoc_deleted
    }
