"""Scheduled job model for automated IntelX scans"""
from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from backend.database import Base


class ScheduledJob(Base):
    """
    Persisted scheduler configuration for recurring IntelX scans.
    - keywords: comma-separated list of queries (domain, URL, email, etc.)
    - time_filter: D1, D7, D30 (default D1 = yesterday 00:00-23:59)
    - schedule: cron expression (e.g., "0 6 * * *" for 06:00 daily)
    - timezone: IANA TZ name (e.g., "Asia/Jakarta")
    - notifications: selection flags; send_alert will be derived by runtime
    - last_run/next_run: telemetry
    """
    __tablename__ = "scheduled_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    keywords = Column(Text, nullable=False)  # comma-separated values
    time_filter = Column(String(10), nullable=False, default="D1")
    schedule = Column(String(50), nullable=False)  # cron string, e.g., "0 6 * * *"
    timezone = Column(String(64), nullable=False, default="Asia/Jakarta")

    notify_telegram = Column(Boolean, nullable=False, default=False)
    notify_slack = Column(Boolean, nullable=False, default=False)
    notify_teams = Column(Boolean, nullable=False, default=False)

    is_active = Column(Boolean, nullable=False, default=True)

    last_run = Column(DateTime, nullable=True)
    next_run = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<ScheduledJob(id={self.id}, name={self.name}, schedule={self.schedule}, active={self.is_active})>"

    def to_dict(self):
        # Helper to format datetime as ISO with UTC indicator
        def format_utc_iso(dt):
            if dt is None:
                return None
            iso_str = dt.isoformat()
            # Append 'Z' if no timezone info present (assumes UTC from database)
            if '+' not in iso_str and 'Z' not in iso_str:
                iso_str += 'Z'
            return iso_str
        
        return {
            "id": str(self.id),
            "name": self.name,
            "keywords": self.get_keywords_list(),
            "time_filter": self.time_filter,
            "schedule": self.schedule,
            "timezone": self.timezone,
            "notify_telegram": self.notify_telegram,
            "notify_slack": self.notify_slack,
            "notify_teams": self.notify_teams,
            "is_active": self.is_active,
            "last_run": format_utc_iso(self.last_run),
            "next_run": format_utc_iso(self.next_run),
            "created_at": format_utc_iso(self.created_at),
            "updated_at": format_utc_iso(self.updated_at),
        }

    def get_keywords_list(self):
        """
        Return keywords as normalized list:
        - split on commas
        - strip whitespace
        - dedupe while preserving order
        - drop empties
        """
        raw = self.keywords or ""
        seen = set()
        result = []
        for item in [x.strip() for x in raw.split(",")]:
            if item and item not in seen:
                seen.add(item)
                result.append(item)
        return result