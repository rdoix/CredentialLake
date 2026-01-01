"""Analytics service for dashboard statistics"""
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from urllib.parse import urlparse
from datetime import datetime, timedelta
from typing import List, Dict
from backend.utils.domain_utils import normalize_domain, extract_root_domain as util_extract_root_domain, PUBLIC_SUFFIX_MULTI

from backend.models.credential import Credential
from backend.models.scan_job import ScanJob
from backend.config import settings


class AnalyticsService:
    """Service for generating analytics and statistics"""
    
    @staticmethod
    def get_dashboard_stats(db: Session) -> Dict:
        """Get main dashboard statistics"""
        # Total credentials (unique rows after deduplication)
        total_credentials = db.query(func.count(Credential.id)).scalar()
        
        # Total unique ROOT domains (normalize each distinct stored domain and collapse to root)
        distinct_raw = [d[0] for d in db.query(Credential.domain).distinct().all()]
        root_set = set()

        # Fallback extractor to be resilient if normalize_domain returns 'other'
        import re as _re
        _label = r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)"
        _dom_pat = _re.compile(rf"(?:{_label}\.)+[a-z]{{2,24}}")

        for raw in distinct_raw:
            try:
                norm = normalize_domain(raw)
                if not norm or norm == 'other':
                    # Try salvage from raw text
                    m = _dom_pat.search(str(raw or "").lower())
                    norm = m.group(0) if m else "other"
                if norm and norm != 'other':
                    root = util_extract_root_domain(norm) or "other"
                    if root != 'other':
                        root_set.add(root)
            except Exception:
                continue

        total_domains = len(root_set)
        if settings.DEBUG:
            try:
                print(f"[AnalyticsService] DashboardStats: unique root domains = {total_domains}")
            except Exception:
                pass
        
        # Admin credentials count
        admin_credentials = db.query(func.count(Credential.id)).filter(
            Credential.is_admin == True
        ).scalar()
        
        # Recent scans (last 24 hours)
        yesterday = datetime.now() - timedelta(hours=24)
        recent_scans_24h = db.query(func.count(ScanJob.id)).filter(
            ScanJob.created_at >= yesterday
        ).scalar()
        
        # Total scans
        total_scans = db.query(func.count(ScanJob.id)).scalar()
        
        return {
            'total_credentials': total_credentials or 0,
            'total_domains': total_domains or 0,
            'admin_credentials': admin_credentials or 0,
            'recent_scans_24h': recent_scans_24h or 0,
            'total_scans': total_scans or 0
        }
    
    @staticmethod
    def get_top_domains(db: Session, limit: int = 10) -> List[Dict]:
        """Get top ROOT domains by credential count (unique), exclude 'other' noise"""
        # Helper: normalize and collapse to ROOT domain using public suffix rules
        def sanitize_sub(value: str) -> str:
            """
            Normalize and collapse to ROOT domain, with robust fallback when the normalizer
            returns 'other' (e.g., parsing noise). This ensures we don't drop valid domains.
            """
            norm = normalize_domain(value or "")
            if not norm or norm == "other":
                # Fallback: extract any domain-like token via regex then reduce to root
                import re as _re
                _label = r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)"
                _pat = _re.compile(rf"(?:{_label}\.)+[a-z]{{2,24}}")
                m = _pat.search(str(value or "").lower())
                if not m:
                    return "other"
                norm = m.group(0)
            root = util_extract_root_domain(norm)
            return root or "other"

        # Query raw grouped stats per stored domain
        results = db.query(
            Credential.domain,
            func.count(Credential.id).label('total_credentials'),
            func.sum(case((Credential.is_admin == True, 1), else_=0)).label('admin_count'),
            func.min(Credential.first_seen).label('first_discovered'),
            func.max(Credential.last_seen).label('last_seen'),
            func.sum(Credential.seen_count).label('total_occurrences')
        ).group_by(Credential.domain).all()

        # Diagnostics: show sample of raw domains and their sanitized forms (DEBUG only)
        if settings.DEBUG:
            try:
                sample = [(str(r.domain), sanitize_sub(r.domain)) for r in results[:15]]
                print("[AnalyticsService] TopDomains raw->sanitized sample:")
                for orig, san in sample:
                    print(f"  - {orig} -> {san}")
            except Exception as e:
                print("[AnalyticsService] TopDomains sample diagnostics error:", e)

        # Aggregate by sanitized subdomain (exclude 'other')
        agg: Dict[str, Dict] = {}
        other_sum = 0
        for r in results:
            sub = sanitize_sub(r.domain)
            if sub == 'other':
                other_sum += int(r.total_credentials or 0)
                continue

            entry = agg.get(sub)
            if not entry:
                agg[sub] = {
                    'domain': sub,
                    'total_credentials': int(r.total_credentials or 0),
                    'admin_count': int(r.admin_count or 0),
                    'first_discovered': r.first_discovered,
                    'last_seen': r.last_seen,
                    'total_occurrences': int(r.total_occurrences or 0),
                }
            else:
                entry['total_credentials'] += int(r.total_credentials or 0)
                entry['admin_count'] += int(r.admin_count or 0)
                entry['total_occurrences'] += int(r.total_occurrences or 0)
                if r.first_discovered:
                    entry['first_discovered'] = r.first_discovered if entry['first_discovered'] is None else min(entry['first_discovered'], r.first_discovered)
                if r.last_seen:
                    entry['last_seen'] = r.last_seen if entry['last_seen'] is None else max(entry['last_seen'], r.last_seen)

        if other_sum and settings.DEBUG:
            print(f"[AnalyticsService] Excluded {other_sum} credentials mapped to 'other' from Top Subdomains")

        # Sort by total credentials and limit
        sorted_list = sorted(agg.values(), key=lambda x: x['total_credentials'], reverse=True)[:limit]
        
        # DEBUG: Log the final top domains being returned
        if settings.DEBUG:
            print(f"\n[AnalyticsService] Top {limit} Domains (sorted by unique credentials):")
            for idx, entry in enumerate(sorted_list, 1):
                print(f"  {idx}. {entry['domain']}: {entry['total_credentials']} credentials (admin: {entry['admin_count']})")

        # Serialize
        # IMPORTANT: DomainStats schema requires datetime (not Optional).
        # Ensure we always return valid datetime objects to avoid FastAPI validation errors.
        return [
            {
                'domain': e['domain'],
                'total_credentials': e['total_credentials'],
                'admin_count': e['admin_count'],
                'first_discovered': e['first_discovered'] or datetime.now(),
                'last_seen': e['last_seen'] or datetime.now(),
                'total_occurrences': e['total_occurrences']
            }
            for e in sorted_list
        ]
    
    @staticmethod
    def get_recent_scans(db: Session, limit: int = 10) -> List[Dict]:
        """Get recent scan jobs"""
        jobs = db.query(ScanJob).order_by(
            desc(ScanJob.created_at)
        ).limit(limit).all()
        
        return [job.to_dict() for job in jobs]
    
    @staticmethod
    def get_top_passwords(db: Session, limit: int = 50) -> List[Dict]:
        """Get most common leaked passwords"""
        results = db.query(
            Credential.password,
            func.count(Credential.id).label('count')
        ).group_by(
            Credential.password
        ).order_by(
            desc('count')
        ).limit(limit).all()
        return [
            {'text': r[0], 'value': int(r[1] or 0)}
            for r in results
            if r[0] not in (None, '', ' ')
        ]
    
    @staticmethod
    def get_domain_details(db: Session, domain: str) -> Dict:
        """Get detailed statistics for a specific ROOT domain (aggregated across subdomains)"""
        # Normalize incoming value, then collapse to root domain
        target_norm = normalize_domain(domain) or 'other'
        target_root = util_extract_root_domain(target_norm) if target_norm != 'other' else 'other'
        
        # Collect all raw domain variants that map to the same root domain
        all_raw = [d[0] for d in db.query(Credential.domain).distinct().all()]
        raw_group = []
        for raw in all_raw:
            nd = normalize_domain(raw)
            if nd == 'other':
                continue
            rd = util_extract_root_domain(nd)
            if rd == target_root:
                raw_group.append(raw)
        
        if not raw_group:
            return {
                'domain': target_root,
                'total_credentials': 0,
                'admin_count': 0,
                'first_discovered': None,
                'last_seen': None,
                'total_occurrences': 0
            }
        
        total = db.query(func.count(Credential.id)).filter(
            Credential.domain.in_(raw_group)
        ).scalar()
        
        admin_count = db.query(func.sum(case((Credential.is_admin == True, 1), else_=0))).filter(
            Credential.domain.in_(raw_group)
        ).scalar()
        
        stats = db.query(
            func.min(Credential.first_seen).label('first_seen'),
            func.max(Credential.last_seen).label('last_seen'),
            func.sum(Credential.seen_count).label('total_occurrences')
        ).filter(
            Credential.domain.in_(raw_group)
        ).first()
        
        if settings.DEBUG:
            try:
                print(f"[AnalyticsService] DomainDetails root={target_root} raw_variants={len(raw_group)} total={int(total or 0)} admin={int(admin_count or 0)}")
            except Exception:
                pass
        
        return {
            'domain': target_root,
            'total_credentials': int(total or 0),
            'admin_count': int(admin_count or 0),
            'first_discovered': stats.first_seen.isoformat() if stats and stats.first_seen else None,
            'last_seen': stats.last_seen.isoformat() if stats and stats.last_seen else None,
            'total_occurrences': int(stats.total_occurrences or 0) if stats else 0
        }
    
    @staticmethod
    def get_credentials_timeline(db: Session, days: int = 30) -> List[Dict]:
        """Get credentials discovered over time"""
        start_date = datetime.now() - timedelta(days=days)
        
        results = db.query(
            func.date(Credential.first_seen).label('date'),
            func.count(Credential.id).label('count')
        ).filter(
            Credential.first_seen >= start_date
        ).group_by(
            func.date(Credential.first_seen)
        ).order_by('date').all()
        
        return [
            {
                'date': r.date.isoformat() if r.date else None,
                'count': r.count
            }
            for r in results
        ]