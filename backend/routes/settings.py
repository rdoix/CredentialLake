"""Settings API routes: manage IntelX API key and notifier providers (Teams/Slack/Telegram)"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from backend.database import get_db
from backend.models.settings import AppSettings

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_singleton_settings(db: Session) -> AppSettings:
    """Fetch the singleton settings row, create if not exists"""
    settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/", response_model=dict)
def get_settings(db: Session = Depends(get_db)):
    """Return masked settings; secrets are not exposed"""
    settings = _get_singleton_settings(db)
    return settings.to_dict()


@router.post("/", response_model=dict)
def update_settings(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Update application settings.
    Accepts JSON body with any of:
      - intelx_api_key
      - notify_provider: 'none'|'teams'|'slack'|'telegram'
      - teams_webhook_url
      - slack_webhook_url
      - telegram_bot_token
      - telegram_chat_id
      - rq_workers: int (job-level concurrency; number of RQ worker processes)
      - parallel_domain_workers: int (per-job ThreadPool workers for multi-domain scans)
      - domain_scan_delay: float (seconds delay between domain requests)
    """
    settings = _get_singleton_settings(db)

    # Validate provider choice
    provider = payload.get("notify_provider")
    if provider and provider not in ("none", "teams", "slack", "telegram"):
        raise HTTPException(status_code=400, detail="Invalid notify_provider")

    # Assign provided fields if present
    if "intelx_api_key" in payload:
        settings.intelx_api_key = payload.get("intelx_api_key") or None
    if "notify_provider" in payload:
        settings.notify_provider = payload.get("notify_provider") or "none"
    if "teams_webhook_url" in payload:
        settings.teams_webhook_url = payload.get("teams_webhook_url") or None
    if "slack_webhook_url" in payload:
        settings.slack_webhook_url = payload.get("slack_webhook_url") or None
    if "telegram_bot_token" in payload:
        settings.telegram_bot_token = payload.get("telegram_bot_token") or None
    if "telegram_chat_id" in payload:
        settings.telegram_chat_id = payload.get("telegram_chat_id") or None

    # Runtime tunables: rq_workers / parallel_domain_workers / domain_scan_delay
    if "rq_workers" in payload:
        rw = payload.get("rq_workers")
        try:
            settings.rq_workers = int(rw) if rw is not None else None
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="rq_workers must be an integer")
        if settings.rq_workers is not None and settings.rq_workers <= 0:
            raise HTTPException(status_code=400, detail="rq_workers must be greater than 0")

    if "parallel_domain_workers" in payload:
        pdw = payload.get("parallel_domain_workers")
        try:
            settings.parallel_domain_workers = int(pdw) if pdw is not None else None
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="parallel_domain_workers must be an integer")
        if settings.parallel_domain_workers is not None and settings.parallel_domain_workers <= 0:
            raise HTTPException(status_code=400, detail="parallel_domain_workers must be greater than 0")

    if "domain_scan_delay" in payload:
        dsd = payload.get("domain_scan_delay")
        try:
            settings.domain_scan_delay = float(dsd) if dsd is not None else None
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="domain_scan_delay must be a number")
        if settings.domain_scan_delay is not None and settings.domain_scan_delay < 0:
            raise HTTPException(status_code=400, detail="domain_scan_delay must be >= 0")

    db.commit()
    db.refresh(settings)

    # Return masked view including tunables
    return settings.to_dict()