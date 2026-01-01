"""Configuration management for IntelX Scanner Web UI"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Database
    DATABASE_URL: str = "postgresql://scanner:scanner@postgres:5432/intelx_scanner"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    
    # IntelX API
    INTELX_KEY: str = ""
    
    # Teams Webhook
    TEAMS_WEBHOOK_URL: Optional[str] = None
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    
    # Application
    APP_NAME: str = "IntelX Scanner"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    
    # Job settings
    MAX_CONCURRENT_JOBS: int = 3
    JOB_TIMEOUT: int = 3600  # 1 hour
    
    # Parallel scanning settings
    PARALLEL_DOMAIN_WORKERS: int = 20  # Number of concurrent domain scans
    DOMAIN_SCAN_DELAY: float = 0.1  # Delay between domain scans (seconds)
    
    # Retention
    RETENTION_DAYS: int = 90
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 1000
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()