"""Diagnostic script to check domain statistics in the database"""
import sys
from sqlalchemy import func, case
from database import SessionLocal
from models.credential import Credential
from urllib.parse import urlparse

def sanitize_domain(value: str) -> str:
    """Sanitize domain similar to analytics service"""
    s = str(value or "").strip().lower()
    if not s:
        return "other"
    # If looks like URL, parse hostname
    if "://" in s:
        try:
            s = (urlparse(s).hostname or s)
        except Exception:
            pass
    # Strip path and colon tokens (ports or appended noise)
    if "/" in s:
        s = s.split("/", 1)[0]
    if ":" in s:
        s = s.split(":", 1)[0]
    # Strip www.
    if s.startswith("www."):
        s = s[4:]
    # Heuristic: must contain at least one dot and non-numeric label
    if "." not in s:
        return "other"
    parts = s.split(".")
    if all(p.isdigit() for p in parts):
        return "other"
    return s

def main():
    db = SessionLocal()
    try:
        print("=" * 80)
        print("DOMAIN STATISTICS DIAGNOSTIC")
        print("=" * 80)
        
        # Get raw domain stats from database
        results = db.query(
            Credential.domain,
            func.count(Credential.id).label('total_credentials'),
            func.sum(case((Credential.is_admin == True, 1), else_=0)).label('admin_count')
        ).group_by(Credential.domain).all()
        
        print(f"\nTotal unique raw domains in database: {len(results)}")
        print("\nRaw domains (top 20 by credential count):")
        print("-" * 80)
        
        raw_sorted = sorted(results, key=lambda x: x.total_credentials, reverse=True)[:20]
        for idx, r in enumerate(raw_sorted, 1):
            print(f"{idx:2d}. {r.domain:40s} | Creds: {r.total_credentials:5d} | Admin: {r.admin_count:4d}")
        
        # Aggregate by sanitized domain
        agg = {}
        other_sum = 0
        
        for r in results:
            sanitized = sanitize_domain(r.domain)
            if sanitized == 'other':
                other_sum += int(r.total_credentials or 0)
                continue
            
            if sanitized not in agg:
                agg[sanitized] = {
                    'domain': sanitized,
                    'total_credentials': int(r.total_credentials or 0),
                    'admin_count': int(r.admin_count or 0),
                    'raw_domains': [r.domain]
                }
            else:
                agg[sanitized]['total_credentials'] += int(r.total_credentials or 0)
                agg[sanitized]['admin_count'] += int(r.admin_count or 0)
                agg[sanitized]['raw_domains'].append(r.domain)
        
        print(f"\n\nSanitized/Aggregated domains (top 20):")
        print("-" * 80)
        
        sorted_agg = sorted(agg.values(), key=lambda x: x['total_credentials'], reverse=True)[:20]
        for idx, entry in enumerate(sorted_agg, 1):
            raw_count = len(entry['raw_domains'])
            print(f"{idx:2d}. {entry['domain']:40s} | Creds: {entry['total_credentials']:5d} | Admin: {entry['admin_count']:4d} | Raw variants: {raw_count}")
            if raw_count > 1:
                for raw in entry['raw_domains'][:3]:
                    print(f"    - {raw}")
                if raw_count > 3:
                    print(f"    ... and {raw_count - 3} more")
        
        if other_sum:
            print(f"\nExcluded 'other' credentials: {other_sum}")
        
        # Check for catalyst.net specifically
        print("\n" + "=" * 80)
        print("CATALYST.NET ANALYSIS")
        print("=" * 80)
        
        catalyst_variants = [r for r in results if 'catalyst' in r.domain.lower()]
        if catalyst_variants:
            print(f"\nFound {len(catalyst_variants)} raw domain variants containing 'catalyst':")
            for r in catalyst_variants:
                sanitized = sanitize_domain(r.domain)
                print(f"  Raw: {r.domain:40s} -> Sanitized: {sanitized:30s} | Creds: {r.total_credentials:5d} | Admin: {r.admin_count:4d}")
        else:
            print("\nNo domains containing 'catalyst' found in database")
        
    finally:
        db.close()

if __name__ == "__main__":
    main()