-- Migration: Add time_filter column to scan_jobs to persist IntelX time range
-- Enables UI to display time range on Running Jobs and Scheduler history

ALTER TABLE scan_jobs
ADD COLUMN IF NOT EXISTS time_filter VARCHAR(10);

-- Optional backfill: keep existing rows as NULL (interpreted as "All Time" in UI)
UPDATE scan_jobs
SET time_filter = NULL
WHERE time_filter IS NULL;