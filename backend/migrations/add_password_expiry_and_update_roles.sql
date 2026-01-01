-- Migration: Add password_expires_at field and update roles to support 3-tier RBAC
-- Date: 2025-12-18
-- Note: Administrators will never have password expiry (NULL)

-- Add password_expires_at column
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP WITH TIME ZONE;

-- Update existing 'admin' role to 'administrator'
UPDATE users SET role = 'administrator' WHERE role = 'admin';

-- Ensure administrators NEVER have password expiry
UPDATE users SET password_expires_at = NULL WHERE role = 'administrator';

-- Set password expiry for non-administrator users (90 days from now)
-- Only update if they don't already have a future expiry date
UPDATE users
SET password_expires_at = NOW() + INTERVAL '90 days'
WHERE role IN ('collector', 'user')
  AND (password_expires_at IS NULL OR password_expires_at < NOW());

-- Add comment to document valid roles and expiry policy
COMMENT ON COLUMN users.role IS 'Valid roles: administrator, collector, user';
COMMENT ON COLUMN users.password_expires_at IS 'Password expiry date. NULL = never expires (for administrators)';