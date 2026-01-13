-- Migration: Add display limit settings to app_settings table
-- Date: 2026-01-13
-- Description: Adds configurable default and max display limits for IntelX file inspection

-- Add new columns for display limit configuration
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS default_display_limit INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS max_display_limit INTEGER DEFAULT 500;

-- Update existing row if it exists
UPDATE app_settings 
SET 
    default_display_limit = COALESCE(default_display_limit, 50),
    max_display_limit = COALESCE(max_display_limit, 500)
WHERE id = 1;

-- Add comments for documentation
COMMENT ON COLUMN app_settings.default_display_limit IS 'Default number of IntelX files to inspect per scan (1-500)';
COMMENT ON COLUMN app_settings.max_display_limit IS 'Maximum number of IntelX files that can be inspected per scan (1-500)';