"""Settings API routes: manage IntelX API key and notifier providers (Teams/Slack/Telegram)"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, Any
from pydantic import BaseModel
import logging

from backend.database import get_db
from backend.models.settings import AppSettings
from backend.routes.auth import get_current_user, require_admin
from backend.models.user import User
from backend.services.alert_service import AlertService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


class TestNotificationRequest(BaseModel):
    provider: str  # 'telegram' | 'slack' | 'teams'
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    webhook_url: Optional[str] = None


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
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return masked settings; secrets are not exposed"""
    settings = _get_singleton_settings(db)
    return settings.to_dict()


@router.post("/", response_model=dict)
def update_settings(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update application settings.
    Accepts JSON body with any of:
      - intelx_api_key
      - nvd_api_key (optional - for CVE data sync)
      - notify_provider: 'none'|'teams'|'slack'|'telegram'
      - teams_webhook_url
      - slack_webhook_url
      - telegram_bot_token
      - telegram_chat_id
      - rq_workers: int (job-level concurrency; number of RQ worker processes)
      - parallel_domain_workers: int (per-job ThreadPool workers for multi-domain scans)
      - domain_scan_delay: float (seconds delay between domain requests)
      - default_display_limit: int (default number of IntelX files to inspect)
      - max_display_limit: int (maximum number of IntelX files to inspect)
    """
    settings = _get_singleton_settings(db)

    # Helper: check if a column exists (for safe gradual migrations)
    def _column_exists(table_name: str, column_name: str) -> bool:
        try:
            q = text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            )
            res = db.execute(q, {"t": table_name, "c": column_name}).scalar()
            return bool(res)
        except Exception as e:
            logger.warning(f"settings.update: column existence check failed for {table_name}.{column_name}: {e}")
            return False

    # Validate provider choice
    provider = payload.get("notify_provider")
    if provider and provider not in ("none", "teams", "slack", "telegram"):
        raise HTTPException(status_code=400, detail="Invalid notify_provider")

    # Assign provided fields if present
    if "intelx_api_key" in payload:
        settings.intelx_api_key = payload.get("intelx_api_key") or None
    if "nvd_api_key" in payload:
        settings.nvd_api_key = payload.get("nvd_api_key") or None
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

    # IntelX display limit settings (skip assignment if column does not exist to avoid 500)
    if "default_display_limit" in payload:
        ddl = payload.get("default_display_limit")
        if _column_exists("app_settings", "default_display_limit"):
            try:
                settings.default_display_limit = int(ddl) if ddl is not None else None
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="default_display_limit must be an integer")
            if settings.default_display_limit is not None and (settings.default_display_limit < 1 or settings.default_display_limit > 500):
                raise HTTPException(status_code=400, detail="default_display_limit must be between 1 and 500")
        else:
            logger.warning("settings.update: default_display_limit column missing in DB; skipping assignment")

    if "max_display_limit" in payload:
        mdl = payload.get("max_display_limit")
        if _column_exists("app_settings", "max_display_limit"):
            try:
                settings.max_display_limit = int(mdl) if mdl is not None else None
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="max_display_limit must be an integer")
            if settings.max_display_limit is not None and (settings.max_display_limit < 1 or settings.max_display_limit > 500):
                raise HTTPException(status_code=400, detail="max_display_limit must be between 1 and 500")
        else:
            logger.warning("settings.update: max_display_limit column missing in DB; skipping assignment")

    try:
        db.commit()
    except Exception as e:
        logger.error(f"settings.update: commit failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings (commit error). Ensure migrations are applied.")
    db.refresh(settings)

    # Return masked view including tunables
    return settings.to_dict()


@router.post("/test-notification")
def test_notification(
    request: TestNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Test notification by sending a test message to the specified provider.
    Does not save settings - just tests the connection.
    """
    provider = request.provider.lower()
    
    if provider not in ('telegram', 'slack', 'teams'):
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    # Build test config
    config = {}
    
    if provider == 'telegram':
        if not request.bot_token or not request.chat_id:
            raise HTTPException(status_code=400, detail="Bot token and chat ID required for Telegram")
        config = {
            "telegram_bot_token": request.bot_token,
            "telegram_chat_id": request.chat_id
        }
    elif provider == 'slack':
        if not request.webhook_url:
            raise HTTPException(status_code=400, detail="Webhook URL required for Slack")
        config = {
            "slack_webhook_url": request.webhook_url
        }
    elif provider == 'teams':
        if not request.webhook_url:
            raise HTTPException(status_code=400, detail="Webhook URL required for Teams")
        config = {
            "teams_webhook_url": request.webhook_url
        }
    
    # Send test notification
    test_credentials = ["test:credential:example.com"]
    test_domains = ["example.com"]
    
    success = AlertService.send_notification(
        provider=provider,
        config=config,
        query="Test Notification",
        credentials=test_credentials,
        domains=test_domains,
        csv_file="test.csv",
        parser_instance=None,
        is_file_mode=False
    )
    
    if success:
        return {"status": "success", "message": f"Test notification sent to {provider}"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send test notification to {provider}")