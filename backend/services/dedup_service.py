"""Deduplication service for credentials"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Tuple, Optional
from urllib.parse import urlparse
import re
from backend.utils.domain_utils import normalize_domain, best_domain_from

from backend.models.credential import Credential
from backend.models.scan_job import JobCredential


class DedupService:
    """Service for handling credential deduplication and timestamp tracking"""
    
    @staticmethod
    def extract_domain(url: str) -> str:
        """Extract and normalize domain from URL or string"""
        if not url:
            return "other"
        
        try:
            # Parse URL properly
            parsed = urlparse(url)
            # Get hostname/netloc (e.g., 'app.example.id' from 'https://app.example.id/path')
            domain = parsed.netloc or parsed.path or url
            
            # Remove port if present
            if ':' in domain:
                domain = domain.split(':')[0]
            
            # Remove www. prefix
            if domain.startswith('www.'):
                domain = domain[4:]
            
            # Validate it looks like a domain
            if domain and '.' in domain and not domain.replace('.', '').replace('-', '').isdigit():
                return domain.lower().strip()
            
            # Fallback to normalize_domain for edge cases
            return normalize_domain(domain)
        except Exception as e:
            print(f"[DedupService.extract_domain] Error parsing url={url}: {e}")
            return "other"
    
    @staticmethod
    def check_admin_keywords(username: str, password: str) -> bool:
        """Check if credential contains admin-related keywords"""
        admin_keywords = [
            'admin', 'administrator', 'root', 'superuser',
            'sysadmin', 'webadmin', 'dbadmin', 'sudo'
        ]
        text = f"{username} {password}".lower()
        return any(keyword in text for keyword in admin_keywords)
    
    @staticmethod
    def upsert_credential(
        db: Session,
        url: str,
        username: str,
        password: str,
        job_id: str
    ) -> Tuple[int, bool]:
        """
        Insert or update credential with deduplication.
        Returns (credential_id, is_new)
        
        If credential exists:
        - Updates last_seen timestamp
        - Increments seen_count
        - Returns (id, False)
        
        If credential is new:
        - Creates new record with first_seen and last_seen
        - Sets seen_count to 1
        - Returns (id, True)
        """
        # Extract domain from URL first, then fallback to username
        domain = DedupService.extract_domain(url) if url else ''
        if domain == 'other' or not domain:
            # Fallback: try to extract from username (email domain)
            domain = best_domain_from('', url=url, username=username)
        
        # Diagnostic logging for domain extraction
        print(f"[DedupService.upsert_credential] url={url[:50] if url else 'None'} username={username[:30] if username else 'None'} -> domain={domain}")
        
        is_admin = DedupService.check_admin_keywords(username, password)
        
        # Try to find existing credential
        existing = db.query(Credential).filter_by(
            url=url,
            username=username,
            password=password
        ).first()
        
        if existing:
            # Update existing credential
            existing.last_seen = datetime.now()
            existing.seen_count += 1
            db.commit()
            
            # Create job association
            job_cred = JobCredential(
                job_id=job_id,
                credential_id=existing.id,
                is_new=False
            )
            db.add(job_cred)
            db.commit()
            
            return (existing.id, False)
        else:
            # Create new credential
            new_cred = Credential(
                url=url,
                username=username,
                password=password,
                domain=domain,
                is_admin=is_admin,
                first_seen=datetime.now(),
                last_seen=datetime.now(),
                seen_count=1
            )
            db.add(new_cred)
            db.flush()  # Get the ID
            
            # Create job association
            job_cred = JobCredential(
                job_id=job_id,
                credential_id=new_cred.id,
                is_new=True
            )
            db.add(job_cred)
            db.commit()
            
            return (new_cred.id, True)
    
    @staticmethod
    def bulk_upsert_credentials(
        db: Session,
        credentials: list,
        job_id: str
    ) -> Tuple[int, int]:
        """
        Bulk upsert credentials.
        Returns (new_count, duplicate_count)
        """
        new_count = 0
        duplicate_count = 0
        
        for cred in credentials:
            url = cred.get('url', '')
            username = cred.get('username', '')
            password = cred.get('password', '')
            
            if url and username and password:
                _, is_new = DedupService.upsert_credential(
                    db, url, username, password, job_id
                )
                if is_new:
                    new_count += 1
                else:
                    duplicate_count += 1
        
        return (new_count, duplicate_count)