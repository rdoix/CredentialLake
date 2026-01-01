-- Migration: Add pause_requested column to scan_jobs table
-- Date: 2025-12-17
-- Description: Adds pause functionality to job control system

-- Add pause_requested column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scan_jobs' 
        AND column_name = 'pause_requested'
    ) THEN
        ALTER TABLE scan_jobs 
        ADD COLUMN pause_requested BOOLEAN NOT NULL DEFAULT FALSE;
        
        RAISE NOTICE 'Added pause_requested column to scan_jobs table';
    ELSE
        RAISE NOTICE 'pause_requested column already exists in scan_jobs table';
    END IF;
END $$;

-- Update status enum to include 'paused' if using enum type
-- Note: If status is a VARCHAR, this is not needed
-- Uncomment if you're using PostgreSQL ENUM type:
-- ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'paused';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'scan_jobs' 
AND column_name IN ('pause_requested', 'cancel_requested', 'status')
ORDER BY column_name;