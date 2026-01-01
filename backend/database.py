"""Database connection and session management"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from typing import Generator
import logging
from backend.config import settings

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=settings.DEBUG
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for FastAPI to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables by importing models"""
    # Import models to register metadata with Base before creating tables
    from backend.models import credential, scan_job, settings, scheduled_job, user  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Safe migration: ensure new columns exist for cancellation feature
    try:
        safe_migrate_scan_jobs()
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"init_db: safe_migrate_scan_jobs failed: {e}")

def safe_migrate_scan_jobs():
    """
    Ensure new columns exist on scan_jobs to support newer features.
    Adds columns in-place without dropping data.
    """
    with engine.connect() as conn:
        # Queue/job cancellation support columns
        conn.execute(text("ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS rq_job_id VARCHAR(64)"))
        conn.execute(text("ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS pause_requested BOOLEAN NOT NULL DEFAULT FALSE"))
        # IntelX time range persistence column
        conn.execute(text("ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS time_filter VARCHAR(10)"))