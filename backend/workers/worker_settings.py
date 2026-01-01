#!/usr/bin/env python3
"""
Helper to read runtime tunables from AppSettings stored in DB.
Used by worker entrypoint to override RQ_WORKERS from Settings page.

References:
- [AppSettings model](backend/models/settings.py)
- [Database session](backend/database.py)
"""

from typing import Optional
import sys

try:
    # Ensure backend modules are importable (PYTHONPATH=/app in worker container)
    from backend.database import SessionLocal
    from backend.models.settings import AppSettings
except Exception as e:
    # Fallback: cannot import backend modules
    print(5)
    sys.exit(0)


def get_app_settings() -> Optional[AppSettings]:
    db = SessionLocal()
    try:
        settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        return settings
    except Exception:
        return None
    finally:
        db.close()


def get_rq_workers(default: int = 5) -> int:
    """
    Return desired number of RQ worker processes from AppSettings.rq_workers if set (>0),
    otherwise return default.
    """
    s = get_app_settings()
    try:
        if s and s.rq_workers and int(s.rq_workers) > 0:
            return int(s.rq_workers)
    except Exception:
        pass
    return default


def get_parallel_domain_workers(default: int = 20) -> int:
    """
    Return desired ThreadPool size for multi-domain scans, from AppSettings.parallel_domain_workers if set (>0).
    """
    s = get_app_settings()
    try:
        if s and s.parallel_domain_workers and int(s.parallel_domain_workers) > 0:
            return int(s.parallel_domain_workers)
    except Exception:
        pass
    return default


def get_domain_scan_delay(default: float = 0.1) -> float:
    """
    Return desired delay between domain requests (seconds) from AppSettings.domain_scan_delay if set (>=0).
    """
    s = get_app_settings()
    try:
        if s and s.domain_scan_delay is not None and float(s.domain_scan_delay) >= 0.0:
            return float(s.domain_scan_delay)
    except Exception:
        pass
    return default


if __name__ == "__main__":
    # Print only the RQ workers count to stdout so shell can capture it.
    # This script is invoked by worker entrypoint to determine RQ_WORKERS dynamically.
    print(get_rq_workers())