"""CVE routes for vulnerability data management"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from backend.database import get_db
from backend.services.cve_service import CVEService
from backend.models.schemas import CVEResponse, CVEListResponse, CVEStats
from backend.models.settings import AppSettings
from backend.routes.auth import get_current_user, require_admin
from backend.models.user import User

router = APIRouter(prefix="/api/cve", tags=["cve"])


@router.get("/stats", response_model=CVEStats)
def get_cve_stats(
    days: Optional[int] = Query(None, ge=1, le=365, description="Filter CVEs from last N days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get CVE statistics for dashboard (optionally filtered by days)"""
    stats = CVEService.get_cve_stats(db, days_filter=days)
    return stats


@router.get("/recent", response_model=List[CVEResponse])
def get_recent_cves(
    limit: int = Query(10, ge=1, le=100),
    days: Optional[int] = Query(None, ge=1, le=365, description="Filter CVEs from last N days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get most recent CVEs (backend now excludes rejected, optionally filtered by days)"""
    cves = CVEService.get_recent_cves(db, limit, days_filter=days)
    return [cve.to_dict() for cve in cves]


@router.get("/search", response_model=CVEListResponse)
def search_cves(
    keyword: Optional[str] = Query(None, description="Search in CVE ID or description"),
    year: Optional[int] = Query(None, ge=1999, le=2030, description="Filter by publication year"),
    severity: Optional[List[str]] = Query(None, description="Filter by severity (can specify multiple)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    min_cvss: Optional[float] = Query(None, ge=0.0, le=10.0, description="Minimum CVSS score"),
    max_cvss: Optional[float] = Query(None, ge=0.0, le=10.0, description="Maximum CVSS score"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    hide_rejected: bool = Query(False, description="Hide NVD rejected CVEs (reserved but not used)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search CVEs with advanced filtering
    
    Filters:
    - keyword: Search in CVE ID or description
    - year: Filter by publication year (1999-2030)
    - severity: CRITICAL, HIGH, MEDIUM, LOW (can specify multiple)
    - start_date/end_date: Date range filter (YYYY-MM-DD)
    - min_cvss/max_cvss: CVSS score range (0.0-10.0)
    - hide_rejected: Exclude rejected CVEs (reserved but not used)
    - limit/offset: Pagination
    """
    results, total = CVEService.search_cves(
        db=db,
        keyword=keyword,
        year=year,
        severities=severity,
        start_date=start_date,
        end_date=end_date,
        min_cvss=min_cvss,
        max_cvss=max_cvss,
        limit=limit,
        offset=offset,
        hide_rejected=hide_rejected,
    )
    
    return {
        'items': [cve.to_dict() for cve in results],
        'total': total,
        'limit': limit,
        'offset': offset
    }


@router.get("/year/{year}", response_model=List[CVEResponse])
def get_cves_by_year(
    year: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get CVEs filtered by publication year"""
    if year < 1999 or year > 2030:
        raise HTTPException(status_code=400, detail="Year must be between 1999 and 2030")
    
    cves = CVEService.get_cves_by_year(db, year, limit, offset)
    return [cve.to_dict() for cve in cves]


@router.get("/severity/{severity}", response_model=List[CVEResponse])
def get_cves_by_severity(
    severity: str,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get CVEs filtered by severity level"""
    valid_severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    if severity.upper() not in valid_severities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Must be one of: {', '.join(valid_severities)}"
        )
    
    cves = CVEService.get_cves_by_severity(db, severity, limit, offset)
    return [cve.to_dict() for cve in cves]


@router.post("/sync")
def sync_cves_from_nvd(
    days: int = Query(7, ge=1, le=30, description="Number of days to fetch"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Fetch and sync recent CVEs from NVD API
    
    This endpoint fetches CVEs from the National Vulnerability Database
    and syncs them to the local database. Use sparingly to avoid rate limits.
    
    Note: Without an API key, NVD limits to 5 requests per 30 seconds.
    With an API key (configured in Settings), limit increases to 50 requests per 30 seconds.
    """
    # Fetch from NVD (pass db session to get API key from settings)
    cves = CVEService.fetch_recent_cves(days=days, db=db)
    
    if not cves:
        return {
            'success': False,
            'message': 'No CVEs fetched from NVD',
            'created': 0,
            'updated': 0
        }
    
    # Sync to database
    result = CVEService.sync_cves_to_db(db, cves)

    # Update last CVE sync timestamp in settings (timezone-aware UTC)
    try:
        settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if not settings:
            settings = AppSettings(id=1)
            db.add(settings)
            db.commit()
            db.refresh(settings)
        settings.last_cve_sync_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()
    
    return {
        'success': True,
        'message': f'Successfully synced {len(cves)} CVEs',
        'created': result['created'],
        'updated': result['updated'],
        'last_sync_at': settings.last_cve_sync_at.isoformat() if 'settings' in locals() and settings.last_cve_sync_at else None
    }


@router.post("/sync-incremental")
def sync_cves_incremental(
    db: Session = Depends(get_db),
    fallback_days: int = Query(1, ge=1, le=30, description="If no last sync timestamp exists, look back this many days"),
    current_user: User = Depends(require_admin)
):
    """
    Incremental CVE sync using last_cve_sync_at from settings as the start time.
    Falls back to 'fallback_days' window if never synced before (defaults to 1).
    Caps effective window at 30 days.
    """
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if settings and settings.last_cve_sync_at:
        # ensure tz-aware comparison
        last = settings.last_cve_sync_at
        now_utc = datetime.now(timezone.utc)
        # If stored naive (legacy), treat as UTC
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        delta_days = max(1, (now_utc - last).days or 1)
        days = min(delta_days, 30)
    else:
        days = fallback_days

    cves = CVEService.fetch_recent_cves(days=days, db=db)
    if not cves:
        return {
            'success': False,
            'message': 'No CVEs fetched from NVD',
            'created': 0,
            'updated': 0,
            'last_sync_at': settings.last_cve_sync_at.isoformat() if settings and settings.last_cve_sync_at else None
        }

    result = CVEService.sync_cves_to_db(db, cves)

    try:
        if not settings:
            settings = AppSettings(id=1)
            db.add(settings)
            db.commit()
            db.refresh(settings)
        settings.last_cve_sync_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()

    return {
        'success': True,
        'message': f'Incremental sync complete for ~{days} day(s), total fetched {len(cves)}',
        'created': result['created'],
        'updated': result['updated'],
        'last_sync_at': settings.last_cve_sync_at.isoformat() if settings and settings.last_cve_sync_at else None
    }


@router.get("/{cve_id}", response_model=CVEResponse)
def get_cve_by_id(
    cve_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific CVE by ID (e.g., CVE-2024-1234)"""
    from backend.models.cve import CVE
    
    cve = db.query(CVE).filter(CVE.cve_id == cve_id.upper()).first()
    
    if not cve:
        raise HTTPException(status_code=404, detail=f"CVE {cve_id} not found")
    
    return cve.to_dict()