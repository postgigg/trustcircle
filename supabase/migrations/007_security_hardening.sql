-- Security Hardening Infrastructure
-- Migration 007: IP blacklist, threat logging, and request nonces

-- IP blacklist (minimal - just IPs that attacked us)
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL, -- 'sql_injection', 'xss', 'brute_force', 'bot', etc.
  blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = permanent
  request_count_at_block INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON ip_blacklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_expires ON ip_blacklist(expires_at) WHERE expires_at IS NOT NULL;

-- Threat event log (what attack happened, minimal data)
CREATE TABLE IF NOT EXISTS threat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  fingerprint_hash TEXT, -- Just the hash, nothing else
  threat_type TEXT NOT NULL, -- 'rate_limit', 'sql_injection', 'xss', 'emulator', 'bot_pattern', 'replay_attack'
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  endpoint TEXT,
  action_taken TEXT NOT NULL, -- 'logged', 'blocked', 'blacklisted'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threat_log_ip ON threat_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_threat_log_type ON threat_log(threat_type);
CREATE INDEX IF NOT EXISTS idx_threat_log_created ON threat_log(created_at);
CREATE INDEX IF NOT EXISTS idx_threat_log_severity ON threat_log(severity);

-- Request nonce table (prevent replay attacks)
CREATE TABLE IF NOT EXISTS request_nonces (
  nonce TEXT PRIMARY KEY,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup old nonces after 10 minutes
CREATE INDEX IF NOT EXISTS idx_request_nonces_used ON request_nonces(used_at);

-- RLS
ALTER TABLE ip_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_nonces ENABLE ROW LEVEL SECURITY;

-- Server-only policies
CREATE POLICY "Server only" ON ip_blacklist FOR ALL USING (false);
CREATE POLICY "Server only" ON threat_log FOR ALL USING (false);
CREATE POLICY "Server only" ON request_nonces FOR ALL USING (false);

-- Helper function: Check if IP is blacklisted
CREATE OR REPLACE FUNCTION is_ip_blacklisted(p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM ip_blacklist
    WHERE ip_address = p_ip
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_exists;

  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Blacklist an IP
CREATE OR REPLACE FUNCTION blacklist_ip(
  p_ip TEXT,
  p_reason TEXT,
  p_expires_hours INTEGER DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_expires_hours IS NOT NULL THEN
    v_expires := NOW() + (p_expires_hours || ' hours')::INTERVAL;
  ELSE
    v_expires := NULL;
  END IF;

  INSERT INTO ip_blacklist (ip_address, reason, expires_at)
  VALUES (p_ip, p_reason, v_expires)
  ON CONFLICT (ip_address) DO UPDATE
  SET reason = p_reason,
      blacklisted_at = NOW(),
      expires_at = v_expires;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Log a threat event
CREATE OR REPLACE FUNCTION log_threat_event(
  p_ip TEXT,
  p_fingerprint_hash TEXT,
  p_threat_type TEXT,
  p_severity TEXT,
  p_endpoint TEXT,
  p_action TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO threat_log (ip_address, fingerprint_hash, threat_type, severity, endpoint, action_taken)
  VALUES (p_ip, p_fingerprint_hash, p_threat_type, p_severity, p_endpoint, p_action)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check and mark nonce as used
CREATE OR REPLACE FUNCTION use_nonce(p_nonce TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  -- Try to insert the nonce
  INSERT INTO request_nonces (nonce)
  VALUES (p_nonce)
  ON CONFLICT (nonce) DO NOTHING;

  -- Check if we inserted (nonce was not used before)
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN v_inserted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Clean up old nonces (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_nonces()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM request_nonces
  WHERE used_at < NOW() - INTERVAL '10 minutes';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Count recent threats by IP
CREATE OR REPLACE FUNCTION count_recent_threats(
  p_ip TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM threat_log
  WHERE ip_address = p_ip
    AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Auto-blacklist if threshold exceeded
CREATE OR REPLACE FUNCTION check_auto_blacklist(p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_threat_count INTEGER;
  v_blacklisted BOOLEAN := false;
BEGIN
  -- Count recent threats
  v_threat_count := count_recent_threats(p_ip, 24);

  -- Auto-blacklist if 10+ threats in 24 hours
  IF v_threat_count >= 10 THEN
    PERFORM blacklist_ip(p_ip, 'auto_threshold_exceeded', NULL);
    v_blacklisted := true;
  -- Temp blacklist if 5+ threats
  ELSIF v_threat_count >= 5 THEN
    PERFORM blacklist_ip(p_ip, 'auto_threshold_warning', 24);
    v_blacklisted := true;
  END IF;

  RETURN v_blacklisted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired blacklist entries periodically
CREATE OR REPLACE FUNCTION cleanup_expired_blacklist()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ip_blacklist
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
