"""Application settings model (stores API keys and notifier configuration)"""
from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.sql import func
from backend.database import Base


class AppSettings(Base):
    """
    Stores web-configurable settings for the app.
    - intelx_api_key: IntelX API key used by workers if present (overrides env)
    - teams_webhook_url: MS Teams webhook URL
    - slack_webhook_url: Slack Incoming Webhook URL
    - telegram_bot_token: Telegram Bot token
    - telegram_chat_id: Telegram chat/channel ID
    - notify_provider: preferred provider: 'none' | 'teams' | 'slack' | 'telegram'
    """
    __tablename__ = 'app_settings'

    id = Column(Integer, primary_key=True, default=1)
    intelx_api_key = Column(String(512), nullable=True)
    teams_webhook_url = Column(String(512), nullable=True)
    slack_webhook_url = Column(String(512), nullable=True)
    telegram_bot_token = Column(String(512), nullable=True)
    telegram_chat_id = Column(String(256), nullable=True)
    notify_provider = Column(String(32), nullable=False, default='none')  # none|teams|slack|telegram

    # Runtime tunables for parallelism (configurable via Settings page)
    # - rq_workers: number of RQ worker processes to launch in the worker container
    # - parallel_domain_workers: per-job ThreadPool workers for multi-domain scans
    # - domain_scan_delay: delay between domain requests (seconds)
    rq_workers = Column(Integer, nullable=True)
    parallel_domain_workers = Column(Integer, nullable=True)
    domain_scan_delay = Column(Float, nullable=True)

    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        # Return masked keys showing first 2 and last 1 characters
        def mask_key(key: str) -> str:
            if not key or len(key) < 4:
                return None
            return f"{key[:2]}{'*' * (len(key) - 3)}{key[-1]}"
        
        return {
            "notify_provider": self.notify_provider,
            "intelx_api_key": mask_key(self.intelx_api_key) if self.intelx_api_key else None,
            "teams_webhook_url": mask_key(self.teams_webhook_url) if self.teams_webhook_url else None,
            "slack_webhook_url": mask_key(self.slack_webhook_url) if self.slack_webhook_url else None,
            "telegram_bot_token": mask_key(self.telegram_bot_token) if self.telegram_bot_token else None,
            "telegram_chat_id": self.telegram_chat_id,  # Chat ID is not sensitive
            # Expose runtime tunables (not sensitive)
            "rq_workers": self.rq_workers,
            "parallel_domain_workers": self.parallel_domain_workers,
            "domain_scan_delay": self.domain_scan_delay,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }