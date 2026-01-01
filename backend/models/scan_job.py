"""Scan job models"""
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from backend.database import Base


class ScanJob(Base):
    """
    Scan job tracking model.
    Tracks job status, statistics, and timing information.
    """
    __tablename__ = 'scan_jobs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type = Column(String(50), nullable=False)  # 'intelx_single', 'intelx_multi', 'file'
    name = Column(String(255), nullable=True)  # Optional human-readable scan name
    query = Column(Text, nullable=False)
    # IntelX time range code (e.g., 'D1','D7','D30','W1','M3','Y1'); empty/None means All Time
    time_filter = Column(String(10), nullable=True)
    # Status lifecycle: queued -> collecting -> parsing -> upserting -> completed|failed; cancelling|cancelled supported
    status = Column(String(50), default='queued', nullable=False)  # queued, running, completed, failed, collecting, parsing, upserting, cancelling, cancelled, paused
    # Queue job id for RQ
    rq_job_id = Column(String(64), nullable=True)
    # Cooperative cancellation flag
    cancel_requested = Column(Boolean, default=False, nullable=False)
    # Cooperative pause flag
    pause_requested = Column(Boolean, default=False, nullable=False)
    
    # Statistics
    total_raw = Column(Integer, default=0)
    total_parsed = Column(Integer, default=0)
    total_new = Column(Integer, default=0)
    total_duplicates = Column(Integer, default=0)
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # Relationships
    credential_associations = relationship("JobCredential", back_populates="job")
    
    def __repr__(self):
        return f"<ScanJob(id={self.id}, type={self.job_type}, status={self.status})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        duration = None
        if self.started_at and self.completed_at:
            duration = (self.completed_at - self.started_at).total_seconds()
        
        # Helper to format datetime as ISO with UTC indicator
        def format_utc_iso(dt):
            if dt is None:
                return None
            iso_str = dt.isoformat()
            # Append 'Z' if no timezone info present (assumes UTC from database)
            if '+' not in iso_str and 'Z' not in iso_str:
                iso_str += 'Z'
            return iso_str
        
        return {
            'id': str(self.id),
            'job_type': self.job_type,
            'name': self.name,
            'query': self.query,
            'time_filter': self.time_filter,
            'status': self.status,
            'rq_job_id': self.rq_job_id,
            'cancel_requested': self.cancel_requested,
            'pause_requested': self.pause_requested,
            'total_raw': self.total_raw,
            'total_parsed': self.total_parsed,
            'total_new': self.total_new,
            'total_duplicates': self.total_duplicates,
            'started_at': format_utc_iso(self.started_at),
            'completed_at': format_utc_iso(self.completed_at),
            'created_at': format_utc_iso(self.created_at),
            'duration_seconds': duration,
            'error_message': self.error_message
        }


class JobCredential(Base):
    """
    Many-to-many relationship between jobs and credentials.
    Tracks which credentials were found in which jobs and if they were new.
    """
    __tablename__ = 'job_credentials'
    
    job_id = Column(UUID(as_uuid=True), ForeignKey('scan_jobs.id'), primary_key=True)
    credential_id = Column(Integer, ForeignKey('credentials.id'), primary_key=True)
    is_new = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    job = relationship("ScanJob", back_populates="credential_associations")
    credential = relationship("Credential", back_populates="job_associations")
    
    def __repr__(self):
        return f"<JobCredential(job_id={self.job_id}, credential_id={self.credential_id}, is_new={self.is_new})>"