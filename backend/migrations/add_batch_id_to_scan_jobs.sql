-- Add batch_id field to scan_jobs table for grouping related jobs
-- This allows scheduled jobs with multiple keywords to be displayed as a single group

ALTER TABLE scan_jobs 
ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Add index for efficient batch queries
CREATE INDEX IF NOT EXISTS idx_scan_jobs_batch_id ON scan_jobs(batch_id);

-- Add comment for documentation
COMMENT ON COLUMN scan_jobs.batch_id IS 'Groups related scan jobs from the same scheduled execution';