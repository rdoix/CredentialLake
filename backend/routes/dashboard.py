"""Dashboard routes for analytics and statistics"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.services.analytics_service import AnalyticsService
from backend.models.schemas import DashboardStats, DomainStats, PasswordStat
from backend.routes.auth import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get main dashboard statistics"""
    stats = AnalyticsService.get_dashboard_stats(db)
    return stats


@router.get("/top-domains", response_model=List[DomainStats])
def get_top_domains(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get top domains by credential count with admin statistics"""
    domains = AnalyticsService.get_top_domains(db, limit)
    return domains

@router.get("/top-passwords", response_model=List[PasswordStat])
def get_top_passwords(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get most common leaked passwords"""
    passwords = AnalyticsService.get_top_passwords(db, limit)
    return passwords


@router.get("/recent-scans")
def get_recent_scans(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get recent scan jobs"""
    scans = AnalyticsService.get_recent_scans(db, limit)
    return scans


@router.get("/domain/{domain}", response_model=DomainStats)
def get_domain_details(
    domain: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed statistics for a specific domain"""
    details = AnalyticsService.get_domain_details(db, domain)
    return details


@router.get("/timeline")
def get_credentials_timeline(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get credentials discovered over time"""
    timeline = AnalyticsService.get_credentials_timeline(db, days)
    return timeline