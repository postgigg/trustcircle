-- Add current_secret_hash column for invisible device verification
-- This stores the sha256 hash of the rotating secret used for badge verification

ALTER TABLE device_tokens
ADD COLUMN IF NOT EXISTS current_secret_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS secret_updated_at TIMESTAMPTZ;

-- Create index for efficient prefix-based lookups
-- Used for O(1) device verification: WHERE device_token LIKE 'prefix%'
CREATE INDEX IF NOT EXISTS idx_device_tokens_prefix
ON device_tokens (device_token text_pattern_ops);

COMMENT ON COLUMN device_tokens.current_secret_hash IS 'SHA256 hash of current rotating secret for badge verification';
COMMENT ON COLUMN device_tokens.secret_updated_at IS 'Timestamp when secret was last rotated';
