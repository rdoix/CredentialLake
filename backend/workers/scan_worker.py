"""Background worker tasks for scan processing"""
import os
import sys
from datetime import datetime, timezone
from typing import Dict
import traceback
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database import SessionLocal
from backend.models.scan_job import ScanJob
from backend.services.intelx_service import IntelXService
from backend.services.file_service import FileService
from backend.services.parser_service import ParserService
from backend.services.dedup_service import DedupService
from backend.services.alert_service import AlertService
from backend.config import settings
from backend.models.settings import AppSettings

# Cooperative stop exceptions for mid-collecting termination
class CancelRequested(Exception):
    pass

class PauseRequested(Exception):
    pass


def build_should_stop(job_id: str, db: SessionLocal):
    """
    Closure that checks DB flags and raises cooperative stop exceptions.
    Throttled to avoid excessive DB queries causing timeouts.
    """
    last_check = 0.0

    def _should_stop(phase: str):
        nonlocal last_check
        now = time.monotonic()
        # Throttle polling to at most twice per second
        if now - last_check < 0.5:
            return
        last_check = now

        # Ensure we always read a fresh row from the database and not a cached identity
        try:
            db.expire_all()
        except Exception:
            pass

        job = (
            db.query(ScanJob)
            .filter(ScanJob.id == job_id)
            .populate_existing()
            .first()
        )
        if not job:
            return
        if job.cancel_requested:
            print(f"scan_worker[{job_id}]: cancel requested during {phase}")
            raise CancelRequested()
        if job.pause_requested:
            print(f"scan_worker[{job_id}]: pause requested during {phase}")
            raise PauseRequested()

    return _should_stop


def process_intelx_scan(job_id: str, query: str, max_results: int, time_filter: str, limit: int, send_alert: bool):
    """Process single IntelX domain/email scan"""
    db = SessionLocal()
    
    try:
        # Update job status
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if not job:
            return
        
        # Enter collecting phase
        job.status = 'collecting'
        job.started_at = datetime.now(timezone.utc)
        db.commit()
        # Cooperative cancellation and pause: allow cancel/pause during collecting
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job and job.cancel_requested:
            job.status = 'cancelled'
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            print(f"scan_worker.process_intelx_scan[{job_id}]: cancellation requested during collecting; exiting")
            return
        if job and job.pause_requested:
            job.status = 'paused'
            db.commit()
            print(f"scan_worker.process_intelx_scan[{job_id}]: pause requested during collecting; pausing")
            return
        
        # Load app settings and initialize IntelX
        app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        api_key = (app_settings.intelx_api_key if app_settings and app_settings.intelx_api_key else settings.INTELX_KEY)
        intelx_service = IntelXService(api_key)

        # Search IntelX with cooperative stop callback
        should_stop = build_should_stop(job_id, db)
        try:
            raw_credentials = intelx_service.search_single_domain(
                query, max_results, time_filter, limit, should_stop=should_stop
            )
        except CancelRequested:
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job:
                job.status = 'cancelled'
                job.completed_at = datetime.now(timezone.utc)
                db.commit()
            print(f"scan_worker.process_intelx_scan[{job_id}]: cooperative cancel triggered; exiting")
            return
        except PauseRequested:
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job:
                job.status = 'paused'
                db.commit()
            print(f"scan_worker.process_intelx_scan[{job_id}]: cooperative pause triggered; exiting")
            return
        
        # Extract lines from raw credentials
        credential_lines = [cred.get('line', '') for cred in raw_credentials if cred.get('line')]
        if settings.DEBUG:
            print(f"scan_worker.process_intelx_scan[{job_id}]: raw_lines={len(credential_lines)} sample={credential_lines[:3] if credential_lines else []}")
        
        # Cooperative cancel/pause boundary: parsing is non-cancellable/non-pausable
        # Final cancel/pause check before entering parsing
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job and job.cancel_requested:
            job.status = 'cancelled'
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            print(f"scan_worker.process_intelx_scan[{job_id}]: cancellation requested before parsing; cancelling")
            return
        if job and job.pause_requested:
            job.status = 'paused'
            db.commit()
            print(f"scan_worker.process_intelx_scan[{job_id}]: pause requested before parsing; pausing")
            return

        # Enter parsing phase (non-cancellable)
        job.status = 'parsing'
        db.commit()

        # Parse credentials
        parsed_creds, parsed_count, unparsed_count = ParserService.parse_raw_lines(credential_lines)
        print(f"scan_worker.process_intelx_scan[{job_id}]: parsed={parsed_count} unparsed={unparsed_count}")
        
        # Diagnostic: show sample parsed credentials with their URLs (DEBUG only)
        if settings.DEBUG and parsed_creds:
            sample_creds = parsed_creds[:3]
            print(f"scan_worker.process_intelx_scan[{job_id}]: sample_parsed_creds={[(c.get('url', 'NO_URL')[:50], c.get('username', 'NO_USER')[:30]) for c in sample_creds]}")
        
        # Enter upserting phase (non-cancellable per policy)
        job.status = 'upserting'
        db.commit()

        # Upsert to database with deduplication
        print(f"scan_worker.process_intelx_scan[{job_id}]: upserting {len(parsed_creds)} parsed credentials")
        new_count, duplicate_count = DedupService.bulk_upsert_credentials(
            db, parsed_creds, job_id
        )
        print(f"scan_worker.process_intelx_scan[{job_id}]: upsert complete new={new_count} duplicates={duplicate_count}")
        
        # Update job statistics
        job.total_raw = len(credential_lines)
        job.total_parsed = parsed_count
        job.total_new = new_count
        job.total_duplicates = duplicate_count
        job.status = 'completed'
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        print(f"scan_worker.process_intelx_scan[{job_id}]: job completed status={job.status} totals={{'raw': job.total_raw, 'parsed': job.total_parsed, 'new': job.total_new, 'dups': job.total_duplicates}}")
        
        # Send alert if requested using provider from settings
        if send_alert:
            app_settings = app_settings or db.query(AppSettings).filter(AppSettings.id == 1).first()
            provider = app_settings.notify_provider if app_settings else "none"
            config = {
                "teams_webhook_url": app_settings.teams_webhook_url if app_settings else None,
                "slack_webhook_url": app_settings.slack_webhook_url if app_settings else None,
                "telegram_bot_token": app_settings.telegram_bot_token if app_settings else None,
                "telegram_chat_id": app_settings.telegram_chat_id if app_settings else None
            }
            domains = list(set([DedupService.extract_domain(c['url']) for c in parsed_creds]))
            AlertService.send_notification(
                provider,
                config,
                query,
                credential_lines,
                domains,
                f"job_{job_id}.csv",
                None,
                False
            )
        
    except Exception as e:
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job:
            job.status = 'failed'
            job.error_message = str(e) + "\n" + traceback.format_exc()
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


def process_multi_domain_scan(job_id: str, domains: list, max_results: int, time_filter: str, limit: int, send_alert: bool):
    """Process multiple domain IntelX scan with PARALLEL processing"""
    db = SessionLocal()
    
    try:
        # Update job status
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if not job:
            return
        
        # Enter collecting phase
        job.status = 'collecting'
        job.started_at = datetime.now(timezone.utc)
        db.commit()
        
        print(f"scan_worker.process_multi_domain_scan[{job_id}]: Starting PARALLEL scan for {len(domains)} domains")
        
        # Cooperative cancellation and pause: allow cancel/pause during collecting
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job and job.cancel_requested:
            job.status = 'cancelled'
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: cancellation requested during collecting; exiting")
            return
        if job and job.pause_requested:
            job.status = 'paused'
            db.commit()
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: pause requested during collecting; pausing")
            return
        
        # Load app settings and initialize IntelX
        app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        api_key = (app_settings.intelx_api_key if app_settings and app_settings.intelx_api_key else settings.INTELX_KEY)
        intelx_service = IntelXService(api_key)
        
        # Resolve per-job parallelism overrides from AppSettings, falling back to static config
        pdw = (app_settings.parallel_domain_workers if app_settings and app_settings.parallel_domain_workers else settings.PARALLEL_DOMAIN_WORKERS)
        dsd = (app_settings.domain_scan_delay if app_settings and app_settings.domain_scan_delay is not None else settings.DOMAIN_SCAN_DELAY)
        print(f"scan_worker.process_multi_domain_scan[{job_id}]: Using {pdw} parallel workers, delay={dsd}s")
        # Search IntelX with cooperative stop callback for parallel scan
        should_stop = build_should_stop(job_id, db)
        try:
            raw_credentials, domains_found = intelx_service.search_multiple_domains(
                domains, max_results, time_filter, limit, max_workers=pdw, delay_secs=dsd, should_stop=should_stop
            )
        except CancelRequested:
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job:
                job.status = 'cancelled'
                job.completed_at = datetime.now(timezone.utc)
                db.commit()
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: cooperative cancel triggered; exiting")
            return
        except PauseRequested:
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job:
                job.status = 'paused'
                db.commit()
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: cooperative pause triggered; exiting")
            return
        
        # Extract lines
        credential_lines = [cred.get('line', '') for cred in raw_credentials if cred.get('line')]
        if settings.DEBUG:
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: raw_lines={len(credential_lines)} sample={credential_lines[:3] if credential_lines else []}")
        
        # Cooperative cancel/pause boundary: parsing is non-cancellable/non-pausable
        # Final cancel/pause check before entering parsing
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job and job.cancel_requested:
            job.status = 'cancelled'
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: cancellation requested before parsing; cancelling")
            return
        if job and job.pause_requested:
            job.status = 'paused'
            db.commit()
            print(f"scan_worker.process_multi_domain_scan[{job_id}]: pause requested before parsing; pausing")
            return

        # Enter parsing phase (non-cancellable)
        job.status = 'parsing'
        db.commit()

        # Parse credentials
        parsed_creds, parsed_count, unparsed_count = ParserService.parse_raw_lines(credential_lines)
        print(f"scan_worker.process_multi_domain_scan[{job_id}]: parsed={parsed_count} unparsed={unparsed_count}")
        
        # Enter upserting phase (non-cancellable per policy)
        job.status = 'upserting'
        db.commit()

        # Upsert with deduplication
        print(f"scan_worker.process_multi_domain_scan[{job_id}]: upserting {len(parsed_creds)} parsed credentials")
        new_count, duplicate_count = DedupService.bulk_upsert_credentials(
            db, parsed_creds, job_id
        )
        print(f"scan_worker.process_multi_domain_scan[{job_id}]: upsert complete new={new_count} duplicates={duplicate_count}")
        
        # Update job statistics
        job.total_raw = len(credential_lines)
        job.total_parsed = parsed_count
        job.total_new = new_count
        job.total_duplicates = duplicate_count
        job.status = 'completed'
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        print(f"scan_worker.process_multi_domain_scan[{job_id}]: job completed status={job.status} totals={{'raw': job.total_raw, 'parsed': job.total_parsed, 'new': job.total_new, 'dups': job.total_duplicates}}")
        
        # Send alert if requested using provider from settings
        if send_alert:
            app_settings = app_settings or db.query(AppSettings).filter(AppSettings.id == 1).first()
            provider = app_settings.notify_provider if app_settings else "none"
            config = {
                "teams_webhook_url": app_settings.teams_webhook_url if app_settings else None,
                "slack_webhook_url": app_settings.slack_webhook_url if app_settings else None,
                "telegram_bot_token": app_settings.telegram_bot_token if app_settings else None,
                "telegram_chat_id": app_settings.telegram_chat_id if app_settings else None
            }
            AlertService.send_notification(
                provider,
                config,
                f"Multiple domains ({len(domains)})",
                credential_lines,
                domains_found,
                f"job_{job_id}.csv",
                None,
                False
            )
        
    except Exception as e:
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job:
            job.status = 'failed'
            job.error_message = str(e) + "\n" + traceback.format_exc()
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


def process_file_scan(job_id: str, file_path: str, query: str, send_alert: bool):
    """Process file scan"""
    db = SessionLocal()
    
    try:
        # Update job status
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if not job:
            return
        
        # Enter collecting phase
        job.status = 'collecting'
        job.started_at = datetime.now(timezone.utc)
        db.commit()
        # Cooperative cancellation and pause: allow cancel/pause during collecting
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job and job.cancel_requested:
            job.status = 'cancelled'
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            print(f"scan_worker.process_file_scan[{job_id}]: cancellation requested during collecting; exiting")
            return
        if job and job.pause_requested:
            job.status = 'paused'
            db.commit()
            print(f"scan_worker.process_file_scan[{job_id}]: pause requested during collecting; pausing")
            return
        
        # Process file
        credential_lines = FileService.process_file(file_path, query)
        if settings.DEBUG:
            print(f"scan_worker.process_file_scan[{job_id}]: raw_lines={len(credential_lines)} sample={credential_lines[:3] if credential_lines else []}")
        
        # Cooperative cancel/pause boundary: parsing is non-cancellable/non-pausable
        # Final cancel/pause check before entering parsing
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job and job.cancel_requested:
            job.status = 'cancelled'
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            print(f"scan_worker.process_file_scan[{job_id}]: cancellation requested before parsing; cancelling")
            return
        if job and job.pause_requested:
            job.status = 'paused'
            db.commit()
            print(f"scan_worker.process_file_scan[{job_id}]: pause requested before parsing; pausing")
            return

        # Enter parsing phase (non-cancellable)
        job.status = 'parsing'
        db.commit()

        # Parse credentials
        parsed_creds, parsed_count, unparsed_count = ParserService.parse_raw_lines(credential_lines)
        print(f"scan_worker.process_file_scan[{job_id}]: parsed={parsed_count} unparsed={unparsed_count}")
        
        # Enter upserting phase (non-cancellable per policy)
        job.status = 'upserting'
        db.commit()

        # Upsert with deduplication
        print(f"scan_worker.process_file_scan[{job_id}]: upserting {len(parsed_creds)} parsed credentials")
        new_count, duplicate_count = DedupService.bulk_upsert_credentials(
            db, parsed_creds, job_id
        )
        print(f"scan_worker.process_file_scan[{job_id}]: upsert complete new={new_count} duplicates={duplicate_count}")
        
        # Update job statistics
        job.total_raw = len(credential_lines)
        job.total_parsed = parsed_count
        job.total_new = new_count
        job.total_duplicates = duplicate_count
        job.status = 'completed'
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        print(f"scan_worker.process_file_scan[{job_id}]: job completed status={job.status} totals={{'raw': job.total_raw, 'parsed': job.total_parsed, 'new': job.total_new, 'dups': job.total_duplicates}}")
        
        # Send alert if requested using provider from settings
        if send_alert:
            app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
            provider = app_settings.notify_provider if app_settings else "none"
            config = {
                "teams_webhook_url": app_settings.teams_webhook_url if app_settings else None,
                "slack_webhook_url": app_settings.slack_webhook_url if app_settings else None,
                "telegram_bot_token": app_settings.telegram_bot_token if app_settings else None,
                "telegram_chat_id": app_settings.telegram_chat_id if app_settings else None
            }
            domains = list(set([DedupService.extract_domain(c['url']) for c in parsed_creds]))
            AlertService.send_notification(
                provider,
                config,
                query or file_path,
                credential_lines,
                domains,
                f"job_{job_id}.csv",
                None,
                True
            )
        
    except Exception as e:
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if job:
            job.status = 'failed'
            job.error_message = str(e) + "\n" + traceback.format_exc()
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()