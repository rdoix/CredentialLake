"""Pydantic schemas for API validation"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class JobType(str, Enum):
    """Job type enumeration"""
    INTELX_SINGLE = "intelx_single"
    INTELX_MULTI = "intelx_multi"
    FILE = "file"


class JobStatus(str, Enum):
    """Job status enumeration"""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TimeFilter(str, Enum):
    """Time filter options for IntelX searches"""
    D1 = "D1"
    D7 = "D7"
    D30 = "D30"
    W1 = "W1"
    W2 = "W2"
    W4 = "W4"
    M1 = "M1"
    M3 = "M3"
    M6 = "M6"
    Y1 = "Y1"


# Request schemas
class IntelXScanRequest(BaseModel):
    """Request schema for IntelX scan"""
    query: str = Field(..., description="Domain or email to search")
    name: Optional[str] = Field(None, description="Optional human-readable scan name")
    time_filter: Optional[TimeFilter] = None
    max_results: int = Field(100, ge=1, le=1000)
    display_limit: int = Field(10, ge=1, le=100)
    send_alert: bool = False


class IntelXMultiScanRequest(BaseModel):
    """Request schema for multiple domain IntelX scan"""
    domains: List[str] = Field(..., description="List of domains to search")
    name: Optional[str] = Field(None, description="Optional human-readable scan name")
    time_filter: Optional[TimeFilter] = None
    max_results: int = Field(100, ge=1, le=1000)
    display_limit: int = Field(10, ge=1, le=100)
    send_alert: bool = False


class FileScanRequest(BaseModel):
    """Request schema for file scan"""
    query: Optional[str] = Field(None, description="Optional filter query")
    send_alert: bool = False


# Response schemas
class CredentialResponse(BaseModel):
    """Response schema for credential"""
    id: int
    url: str
    username: str
    password: str
    domain: str
    is_admin: bool
    first_seen: datetime
    last_seen: datetime
    seen_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class JobResponse(BaseModel):
    """Response schema for job"""
    id: str
    job_type: str
    name: Optional[str]
    query: str
    time_filter: Optional[str] = None
    status: str
    rq_job_id: Optional[str] = None
    cancel_requested: Optional[bool] = None
    total_raw: int
    total_parsed: int
    total_new: int
    total_duplicates: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    duration_seconds: Optional[float]
    error_message: Optional[str]
    
    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    """Dashboard statistics"""
    total_credentials: int
    total_domains: int
    admin_credentials: int
    recent_scans_24h: int
    total_scans: int


class DomainStats(BaseModel):
    """Domain statistics"""
    domain: str
    total_credentials: int
    admin_count: int
    first_discovered: datetime
    last_seen: datetime
    total_occurrences: int


class PaginatedResponse(BaseModel):
    """Generic paginated response"""
    items: List[dict]
    total: int
    page: int
    page_size: int
    total_pages: int


class JobCreateResponse(BaseModel):
    """Response when creating a new job"""
    job_id: str
    status: str
    message: str


class PasswordStat(BaseModel):
    """Password frequency stat for dashboard"""
    text: str
    value: int


class OrganizationStats(BaseModel):
    """Organization statistics"""
    domain: str
    total_credentials: int
    admin_count: int
    subdomains: List[str]
    subdomain_count: int
    first_discovered: datetime
    last_seen: datetime


class SubdomainStat(BaseModel):
    """Subdomain statistics"""
    subdomain: str
    credential_count: int
    admin_count: int


class RecentCredential(BaseModel):
    """Recent credential for organization"""
    id: int
    email: str
    subdomain: str
    is_admin: bool
    discovered_at: datetime


class OrganizationDetail(BaseModel):
    """Detailed organization information"""
    domain: str
    total_credentials: int
    admin_count: int
    subdomains: List[str]
    subdomain_count: int
    first_discovered: datetime
    last_seen: datetime
    subdomain_stats: List[SubdomainStat]
    recent_credentials: List[RecentCredential]


# Scheduler API schemas
class ScheduledJobRequest(BaseModel):
    """Request schema for creating/updating a scheduled IntelX scan job"""
    name: str = Field(..., description="Human-readable job name")
    keywords: List[str] = Field(..., description="List of keywords/queries (domain, URL, email)")
    time_filter: Optional[TimeFilter] = Field(TimeFilter.D1, description="Time range code (default D1=yesterday)")
    schedule: str = Field(..., description="Cron expression, e.g., '0 6 * * *' for daily 06:00")
    timezone: Optional[str] = Field("Asia/Jakarta", description="IANA timezone for the cron trigger")
    notify_telegram: bool = False
    notify_slack: bool = False
    notify_teams: bool = False
    run_immediately: bool = True

    @validator('keywords')
    def _validate_keywords(cls, v):
        cleaned = [k.strip() for k in v if k and k.strip()]
        if not cleaned:
            raise ValueError("At least one keyword is required")
        return cleaned

    @validator('schedule')
    def _validate_schedule(cls, v):
        if not v or not isinstance(v, str):
            raise ValueError("Cron schedule string is required")
        return v


class ScheduledJobResponse(BaseModel):
    """Response schema for a scheduled job"""
    id: str
    name: str
    keywords: List[str]
    time_filter: TimeFilter
    schedule: str
    timezone: str
    notify_telegram: bool
    notify_slack: bool
    notify_teams: bool
    is_active: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    total_runs: int = 0
    successful_runs: int = 0
    last_credentials: int = 0

    class Config:
        from_attributes = True