"""CVE service for fetching and managing vulnerability data from NVD API"""
import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract

from backend.models.cve import CVE
from backend.models.settings import AppSettings
from backend.config import settings

logger = logging.getLogger(__name__)


class CVEService:
    """Service for fetching CVE data from National Vulnerability Database (NVD)"""
    
    # NVD API v2.0 endpoint
    NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    
    @staticmethod
    def fetch_recent_cves(
        days: int = 7,
        results_per_page: int = 100,
        db: Session = None,
        stop_when_no_new_pages: int = 2,
        preload_existing: bool = True
    ) -> List[Dict]:
        """
        Fetch recent CVEs from NVD API with pagination and rate-limit awareness.
        
        Args:
            days: Number of days to look back
            results_per_page: Preferred results per request (will be adjusted by policy)
            db: Database session (optional, for fetching NVD API key from settings)
            
        Returns:
            List of CVE dictionaries (parsed)
        """
        try:
            import time as _time

            # Try to get NVD API key from database settings first
            nvd_api_key = None
            if db:
                try:
                    app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
                    if app_settings and app_settings.nvd_api_key:
                        nvd_api_key = app_settings.nvd_api_key
                        logger.info("Using NVD API key from database settings")
                except Exception as e:
                    logger.warning(f"Could not fetch NVD API key from database: {e}")
            
            # Fallback to environment variable if not in database
            if not nvd_api_key and hasattr(settings, 'NVD_API_KEY'):
                nvd_api_key = settings.NVD_API_KEY
                if nvd_api_key:
                    logger.info("Using NVD API key from environment variable")
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # Format dates for NVD API (ISO 8601)
            pub_start = start_date.strftime("%Y-%m-%dT00:00:00.000")
            pub_end = end_date.strftime("%Y-%m-%dT23:59:59.999")

            # Preload existing CVE IDs in the date window to avoid re-processing duplicates
            known_ids: set[str] = set()
            if preload_existing and db:
                try:
                    existing_ids = db.query(CVE.cve_id).filter(
                        CVE.published_date >= start_date,
                        CVE.published_date <= end_date
                    ).all()
                    for row in existing_ids:
                        cid = None
                        try:
                            # Row may be a tuple (cve_id,) depending on dialect
                            cid = row[0] if isinstance(row, (tuple, list)) else getattr(row, 'cve_id', None)
                        except Exception:
                            cid = getattr(row, 'cve_id', None)
                        if cid:
                            known_ids.add(cid)
                    logger.info(f"[NVD] Preloaded {len(known_ids)} existing CVE IDs for {pub_start} → {pub_end}")
                except Exception as e:
                    logger.warning(f"[NVD] Preload existing IDs failed: {e}")

            # Rate-limit aware paging policy
            # Without API key: 5 req/30s ⇒ ~1 req/6s; With key: 50 req/30s ⇒ ~1 req/0.6s
            delay_between_requests = 1.0 if nvd_api_key else 7.0
            # NVD typically allows large page sizes; stay conservative to avoid large payloads
            per_page = 200 if nvd_api_key else min(max(20, results_per_page), 100)
            # Safety cap to avoid excessively long syncs
            max_records = 2000 if nvd_api_key else 300

            headers = {'apiKey': nvd_api_key} if nvd_api_key else {}
            logger.info(
                f"Fetching CVEs {pub_start} → {pub_end} with per_page={per_page}, cap={max_records}, delay={delay_between_requests}s"
            )

            collected: List[Dict] = []
            start_index = 0
            total_results = None
            consecutive_no_new_pages = 0

            while True:
                params = {
                    'pubStartDate': pub_start,
                    'pubEndDate': pub_end,
                    'resultsPerPage': per_page,
                    'startIndex': start_index
                }
                response = requests.get(
                    CVEService.NVD_API_BASE,
                    params=params,
                    headers=headers,
                    timeout=30
                )
                response.raise_for_status()
                data = response.json()
                vulnerabilities = data.get('vulnerabilities', [])
                if total_results is None:
                    total_results = int(data.get('totalResults', len(vulnerabilities) or 0))
                    logger.info(f"[NVD] totalResults={total_results} per_page={per_page} startIndex={start_index}")

                parsed_batch = [CVEService._parse_nvd_cve(v) for v in vulnerabilities]

                # Filter out CVEs that already exist (by cve_id)
                new_batch: List[Dict] = []
                for c in parsed_batch:
                    cid = c.get('cve_id')
                    if not cid:
                        continue
                    if cid in known_ids:
                        continue
                    new_batch.append(c)
                    known_ids.add(cid)

                collected.extend(new_batch)
                logger.info(
                    f"[NVD] Page startIndex={start_index} fetched={len(parsed_batch)} new={len(new_batch)} total_new_collected={len(collected)}"
                )

                # Early stop if no new CVEs for consecutive pages to maximize API use
                if len(new_batch) == 0:
                    consecutive_no_new_pages += 1
                else:
                    consecutive_no_new_pages = 0

                if stop_when_no_new_pages and consecutive_no_new_pages >= stop_when_no_new_pages:
                    logger.info(f"[NVD] Early stop: no new CVEs for {consecutive_no_new_pages} consecutive pages")
                    break

                # Stop conditions
                start_index += per_page
                if start_index >= total_results:
                    break
                if len(collected) >= max_records:
                    logger.info(f"[NVD] Reached max_records cap ({max_records}), stopping pagination")
                    break

                # Respect rate limits
                _time.sleep(delay_between_requests)

            return collected

        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching CVEs from NVD: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in fetch_recent_cves: {e}")
            return []
    
    @staticmethod
    def _parse_nvd_cve(vulnerability: Dict) -> Dict:
        """Parse NVD API response into our CVE format"""
        try:
            cve_data = vulnerability.get('cve', {})
            cve_id = cve_data.get('id', '')
            
            # Extract description (prefer English)
            descriptions = cve_data.get('descriptions', [])
            description = ''
            for desc in descriptions:
                if desc.get('lang') == 'en':
                    description = desc.get('value', '')
                    break
            if not description and descriptions:
                description = descriptions[0].get('value', '')
            
            # Extract dates
            published = cve_data.get('published', '')
            modified = cve_data.get('lastModified', '')
            
            # Extract CVSS metrics
            metrics = cve_data.get('metrics', {})
            cvss_v3 = metrics.get('cvssMetricV31', []) or metrics.get('cvssMetricV30', [])
            cvss_v2 = metrics.get('cvssMetricV2', [])
            
            severity = None
            cvss_v3_score = None
            cvss_v3_vector = None
            cvss_v2_score = None
            cvss_v2_vector = None
            
            # Parse CVSS v3
            if cvss_v3:
                cvss_v3_data = cvss_v3[0].get('cvssData', {})
                cvss_v3_score = cvss_v3_data.get('baseScore')
                cvss_v3_vector = cvss_v3_data.get('vectorString')
                severity = cvss_v3_data.get('baseSeverity', '').upper()
            
            # Parse CVSS v2 (fallback)
            if cvss_v2:
                cvss_v2_data = cvss_v2[0].get('cvssData', {})
                cvss_v2_score = cvss_v2_data.get('baseScore')
                cvss_v2_vector = cvss_v2_data.get('vectorString')
                
                # Map v2 score to severity if v3 not available
                if not severity and cvss_v2_score:
                    if cvss_v2_score >= 7.0:
                        severity = 'HIGH'
                    elif cvss_v2_score >= 4.0:
                        severity = 'MEDIUM'
                    else:
                        severity = 'LOW'
            
            # Extract CWE
            weaknesses = cve_data.get('weaknesses', [])
            cwe_id = None
            if weaknesses:
                cwe_descriptions = weaknesses[0].get('description', [])
                if cwe_descriptions:
                    cwe_id = cwe_descriptions[0].get('value', '')
            
            # Extract references
            references = cve_data.get('references', [])
            ref_urls = [ref.get('url', '') for ref in references if ref.get('url')]
            
            # Extract affected products (CPE configurations)
            configurations = cve_data.get('configurations', [])
            affected_products = []
            for config in configurations:
                nodes = config.get('nodes', [])
                for node in nodes:
                    cpe_matches = node.get('cpeMatch', [])
                    for cpe in cpe_matches:
                        if cpe.get('vulnerable'):
                            criteria = cpe.get('criteria', '')
                            if criteria:
                                affected_products.append(criteria)
            
            return {
                'cve_id': cve_id,
                'description': description[:5000] if description else '',  # Limit length
                'published_date': datetime.fromisoformat(published.replace('Z', '+00:00')) if published else datetime.now(),
                'last_modified_date': datetime.fromisoformat(modified.replace('Z', '+00:00')) if modified else datetime.now(),
                'severity': severity,
                'cvss_v3_score': cvss_v3_score,
                'cvss_v3_vector': cvss_v3_vector,
                'cvss_v2_score': cvss_v2_score,
                'cvss_v2_vector': cvss_v2_vector,
                'cwe_id': cwe_id,
                'references': str(ref_urls) if ref_urls else None,
                'affected_products': str(affected_products[:50]) if affected_products else None  # Limit to 50 products
            }
            
        except Exception as e:
            logger.error(f"Error parsing CVE data: {e}")
            return {}
    
    @staticmethod
    def sync_cves_to_db(db: Session, cves: List[Dict]) -> Dict[str, int]:
        """
        Sync fetched CVEs to database with upsert logic
        
        Returns:
            Dictionary with counts of created and updated records
        """
        created = 0
        updated = 0
        
        for cve_data in cves:
            if not cve_data.get('cve_id'):
                continue
            
            try:
                # Check if CVE already exists
                existing = db.query(CVE).filter(CVE.cve_id == cve_data['cve_id']).first()
                
                if existing:
                    # Update existing record
                    for key, value in cve_data.items():
                        if key != 'cve_id':  # Don't update the ID
                            setattr(existing, key, value)
                    updated += 1
                else:
                    # Create new record
                    new_cve = CVE(**cve_data)
                    db.add(new_cve)
                    created += 1
                
                db.commit()
                
            except Exception as e:
                logger.error(f"Error syncing CVE {cve_data.get('cve_id')}: {e}")
                db.rollback()
                continue
        
        logger.info(f"CVE sync complete: {created} created, {updated} updated")
        return {'created': created, 'updated': updated}
    
    @staticmethod
    def get_recent_cves(db: Session, limit: int = 10, days_filter: Optional[int] = None) -> List[CVE]:
        """
        Get most recent CVEs from database (exclude NVD 'rejected' entries)
        
        Args:
            limit: Maximum number of CVEs to return
            days_filter: If provided, only return CVEs from the last N days
        """
        query = db.query(CVE)
        
        # Apply date filter if provided
        if days_filter:
            cutoff_date = datetime.now() - timedelta(days=days_filter)
            query = query.filter(CVE.published_date >= cutoff_date)
        
        # Exclude CVEs with common NVD rejected phrasings
        reject_expr = or_(
            and_(CVE.description.ilike('%rejected%'), CVE.description.ilike('%not used%')),
            CVE.description.ilike('%rejected reason%'),
            CVE.description.ilike('%reserved but not used%'),
            and_(CVE.description.ilike('%withdrawn%'), CVE.description.ilike('%cna%')),
            CVE.description.ilike('%not a vulnerability%'),
            and_(CVE.description.ilike('%duplicate of%'), CVE.description.ilike('%CVE-%'))
        )
        query = query.filter(~reject_expr)
        
        return query.order_by(CVE.published_date.desc()).limit(limit).all()
    
    @staticmethod
    def get_cves_by_year(db: Session, year: int, limit: int = 100, offset: int = 0) -> List[CVE]:
        """Get CVEs filtered by publication year"""
        return db.query(CVE).filter(
            extract('year', CVE.published_date) == year
        ).order_by(CVE.published_date.desc()).limit(limit).offset(offset).all()
    
    @staticmethod
    def get_cves_by_severity(db: Session, severity: str, limit: int = 100, offset: int = 0) -> List[CVE]:
        """Get CVEs filtered by severity level"""
        return db.query(CVE).filter(
            CVE.severity == severity.upper()
        ).order_by(CVE.published_date.desc()).limit(limit).offset(offset).all()
    
    @staticmethod
    def search_cves(
        db: Session,
        keyword: Optional[str] = None,
        year: Optional[int] = None,
        severities: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        min_cvss: Optional[float] = None,
        max_cvss: Optional[float] = None,
        limit: int = 100,
        offset: int = 0,
        hide_rejected: bool = False,
    ) -> tuple[List[CVE], int]:
        """
        Advanced CVE search with multiple filters
        
        Returns:
            Tuple of (results, total_count)
        """
        from datetime import datetime as dt
        
        query = db.query(CVE)
        
        # Apply filters
        filters = []
        
        if keyword:
            keyword_filter = or_(
                CVE.cve_id.ilike(f'%{keyword}%'),
                CVE.description.ilike(f'%{keyword}%')
            )
            filters.append(keyword_filter)
        
        if year:
            filters.append(extract('year', CVE.published_date) == year)
        
        # Date range filter
        if start_date:
            try:
                start_dt = dt.strptime(start_date, '%Y-%m-%d')
                filters.append(CVE.published_date >= start_dt)
            except ValueError:
                pass  # Invalid date format, skip filter
        
        if end_date:
            try:
                end_dt = dt.strptime(end_date, '%Y-%m-%d')
                # Add one day to include the end date
                from datetime import timedelta
                end_dt = end_dt + timedelta(days=1)
                filters.append(CVE.published_date < end_dt)
            except ValueError:
                pass  # Invalid date format, skip filter
        
        # Multiple severities filter
        if severities and len(severities) > 0:
            severity_filters = []
            for sev in severities:
                sev_upper = sev.upper()
                if sev_upper in ("NONE", "UNASSIGNED"):
                    # Special filter: records without severity and not rejected
                    reject_expr = or_(
                        and_(CVE.description.ilike('%rejected%'), CVE.description.ilike('%not used%')),
                        CVE.description.ilike('%rejected reason%'),
                        CVE.description.ilike('%reserved but not used%'),
                        and_(CVE.description.ilike('%withdrawn%'), CVE.description.ilike('%cna%')),
                        CVE.description.ilike('%not a vulnerability%'),
                        and_(CVE.description.ilike('%duplicate of%'), CVE.description.ilike('%CVE-%'))
                    )
                    severity_filters.append(and_(CVE.severity.is_(None), ~reject_expr))
                else:
                    severity_filters.append(CVE.severity == sev_upper)
            
            if severity_filters:
                filters.append(or_(*severity_filters))
        
        if min_cvss is not None:
            filters.append(CVE.cvss_v3_score >= min_cvss)
        
        if max_cvss is not None:
            filters.append(CVE.cvss_v3_score <= max_cvss)

        # Hide NVD "rejected" CVEs if requested
        if hide_rejected:
            reject_expr = or_(
                and_(CVE.description.ilike('%rejected%'), CVE.description.ilike('%not used%')),
                CVE.description.ilike('%rejected reason%'),
                CVE.description.ilike('%reserved but not used%'),
                and_(CVE.description.ilike('%withdrawn%'), CVE.description.ilike('%cna%')),
                CVE.description.ilike('%not a vulnerability%'),
                and_(CVE.description.ilike('%duplicate of%'), CVE.description.ilike('%CVE-%'))
            )
            filters.append(~reject_expr)
        
        if filters:
            query = query.filter(and_(*filters))
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        results = query.order_by(CVE.published_date.desc()).limit(limit).offset(offset).all()
        
        return results, total
    
    @staticmethod
    def get_cve_stats(db: Session, days_filter: Optional[int] = None) -> Dict:
        """
        Get CVE statistics for dashboard (includes UNASSIGNED = no severity and not rejected)
        
        Args:
            days_filter: If provided, only count CVEs from the last N days
        """
        # Build base query with optional date filter
        base_query = db.query(CVE)
        if days_filter:
            cutoff_date = datetime.now() - timedelta(days=days_filter)
            base_query = base_query.filter(CVE.published_date >= cutoff_date)
        
        total = base_query.count() or 0
        
        # Count by explicit severities with date filter
        severity_query = base_query.with_entities(
            CVE.severity,
            func.count(CVE.id)
        ).group_by(CVE.severity)
        severity_counts = severity_query.all()
        
        severity_stats = {
            'CRITICAL': 0,
            'HIGH': 0,
            'MEDIUM': 0,
            'LOW': 0,
            'UNASSIGNED': 0,  # no severity and not rejected
        }
        
        for severity, count in severity_counts:
            if severity in severity_stats:
                severity_stats[severity] = count

        # Count CVEs that have no severity and are not NVD "rejected"
        reject_expr = or_(
            and_(CVE.description.ilike('%rejected%'), CVE.description.ilike('%not used%')),
            CVE.description.ilike('%rejected reason%'),
            CVE.description.ilike('%reserved but not used%'),
            and_(CVE.description.ilike('%withdrawn%'), CVE.description.ilike('%cna%')),
            CVE.description.ilike('%not a vulnerability%'),
            and_(CVE.description.ilike('%duplicate of%'), CVE.description.ilike('%CVE-%'))
        )
        none_query = base_query.filter(
            CVE.severity.is_(None),
            ~reject_expr
        )
        none_count = none_query.count() or 0
        severity_stats['UNASSIGNED'] = none_count
        
        # Recent CVEs (last 7 days) - always relative to current date
        week_ago = datetime.now() - timedelta(days=7)
        recent_count = db.query(func.count(CVE.id)).filter(
            CVE.published_date >= week_ago
        ).scalar() or 0
        
        return {
            'total': total,
            'recent_7days': recent_count,
            'by_severity': severity_stats
        }