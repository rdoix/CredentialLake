-- Migration: Add nvd_api_key column to app_settings table
-- This column stores the optional NVD API key for CVE data synchronization
-- Date: 2026-01-03

-- Add nvd_api_key column to app_settings table
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS nvd_api_key VARCHAR(512);

-- Add comment for documentation
COMMENT ON COLUMN app_settings.nvd_api_key IS 'Optional NVD API key for CVE data sync (increases rate limit from 5 to 50 req/30s)';