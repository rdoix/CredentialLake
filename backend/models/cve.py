"""CVE (Common Vulnerabilities and Exposures) model"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Index
from sqlalchemy.sql import func
from datetime import datetime
from backend.database import Base


class CVE(Base):
    """
    CVE model for storing vulnerability information from NVD/CISA feeds.
    Tracks CVE ID, description, severity, CVSS scores, and publication dates.
    """
    __tablename__ = 'cves'
    
    id = Column(Integer, primary_key=True, index=True)
    cve_id = Column(String(20), unique=True, nullable=False, index=True)  # e.g., CVE-2024-1234
    
    # Basic information
    description = Column(Text, nullable=False)
    published_date = Column(DateTime, nullable=False, index=True)
    last_modified_date = Column(DateTime, nullable=False)
    
    # Severity and scoring
    severity = Column(String(20), nullable=True, index=True)  # CRITICAL, HIGH, MEDIUM, LOW
    cvss_v3_score = Column(Float, nullable=True, index=True)
    cvss_v3_vector = Column(String(100), nullable=True)
    cvss_v2_score = Column(Float, nullable=True)
    cvss_v2_vector = Column(String(100), nullable=True)
    
    # Additional metadata
    cwe_id = Column(String(20), nullable=True)  # Common Weakness Enumeration
    references = Column(Text, nullable=True)  # JSON array of reference URLs
    affected_products = Column(Text, nullable=True)  # JSON array of affected products
    
    # Tracking
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_cve_published_year', func.extract('year', published_date)),
        Index('idx_cve_severity_score', 'severity', 'cvss_v3_score'),
    )
    
    def __repr__(self):
        return f"<CVE(id={self.id}, cve_id={self.cve_id}, severity={self.severity})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses"""
        # Extract title from description (first 100 chars or until first period)
        title = self._extract_title()
        
        # Check if this is a rejected CVE (robust detection across NVD phrasings)
        desc_l = (self.description or '').lower()
        is_rejected = (
            ('rejected' in desc_l and 'not used' in desc_l) or
            ('rejected reason' in desc_l) or
            ('reserved but not used' in desc_l) or
            ('withdrawn' in desc_l and 'cna' in desc_l) or
            ('not a vulnerability' in desc_l) or
            ('duplicate of' in desc_l and 'cve-' in desc_l)
        )
        
        return {
            'id': self.id,
            'cve_id': self.cve_id,
            'title': title,
            'description': self.description,
            'is_rejected': is_rejected,
            'published_date': self.published_date.isoformat() if self.published_date else None,
            'last_modified_date': self.last_modified_date.isoformat() if self.last_modified_date else None,
            'severity': self.severity,
            'cvss_v3_score': self.cvss_v3_score,
            'cvss_v3_vector': self.cvss_v3_vector,
            'cvss_v2_score': self.cvss_v2_score,
            'cvss_v2_vector': self.cvss_v2_vector,
            'cwe_id': self.cwe_id,
            'references': self.references,
            'affected_products': self.affected_products,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def _extract_title(self) -> str:
        """Extract a readable title from description"""
        if not self.description:
            return self.cve_id
        
        # If rejected, use a clear title
        try:
            desc_l = self.description.lower()
            if 'rejected' in desc_l or 'rejected reason' in desc_l or 'reserved but not used' in desc_l:
                return "Rejected CVE"
        except Exception:
            pass
        
        # Take first sentence or first 100 characters
        desc = self.description.strip()
        
        # Try to get first sentence
        first_period = desc.find('.')
        if first_period > 0 and first_period < 150:
            title = desc[:first_period + 1]
        else:
            # Take first 100 chars
            title = desc[:100]
            if len(desc) > 100:
                title += '...'
        
        return title
    
    @property
    def year(self) -> int:
        """Extract year from published date"""
        return self.published_date.year if self.published_date else 0