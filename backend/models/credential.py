"""Credential model with deduplication support"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base


class Credential(Base):
    """
    Credential model with automatic deduplication.
    Unique constraint on (url, username, password) ensures no duplicates.
    Tracks first_seen, last_seen, and seen_count for analytics.
    """
    __tablename__ = 'credentials'
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(500), nullable=False)
    username = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False, index=True)
    is_admin = Column(Boolean, default=False, index=True)
    
    # Timestamp tracking
    first_seen = Column(DateTime, default=func.now(), nullable=False, index=True)
    last_seen = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False, index=True)
    seen_count = Column(Integer, default=1, nullable=False)
    
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relationships
    job_associations = relationship("JobCredential", back_populates="credential")
    
    # Unique constraint for deduplication
    __table_args__ = (
        UniqueConstraint('url', 'username', 'password', name='uq_credential'),
        Index('idx_domain_admin', 'domain', 'is_admin'),
        Index('idx_first_seen', 'first_seen'),
        Index('idx_last_seen', 'last_seen'),
    )
    
    def __repr__(self):
        return f"<Credential(id={self.id}, domain={self.domain}, username={self.username}, admin={self.is_admin})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'url': self.url,
            'username': self.username,
            'password': self.password,
            'domain': self.domain,
            'is_admin': self.is_admin,
            'first_seen': self.first_seen.isoformat() if self.first_seen else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'seen_count': self.seen_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }