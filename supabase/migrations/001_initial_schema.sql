-- TrustCircle Database Schema

-- Zones
CREATE TABLE zones (
  zone_id TEXT PRIMARY KEY,
  zone_name TEXT NOT NULL,
  zone_boundary_hashes TEXT[] NOT NULL,
  color_primary TEXT NOT NULL,
  color_secondary TEXT NOT NULL,
  color_accent TEXT NOT NULL,
  motion_pattern TEXT NOT NULL CHECK (motion_pattern IN ('wave', 'pulse', 'ripple', 'spiral')),
  active_resident_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device tokens
CREATE TABLE device_tokens (
  device_token TEXT PRIMARY KEY,
  device_fingerprint_hash TEXT NOT NULL,
  zone_id TEXT REFERENCES zones(zone_id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_type TEXT NOT NULL DEFAULT 'paid' CHECK (subscription_type IN ('paid', 'subsidized')),
  status TEXT NOT NULL DEFAULT 'verifying'
    CHECK (status IN ('verifying', 'active', 'inactive', 'revoked', 'failed', 'frozen')),
  verification_start_date DATE,
  nights_confirmed INTEGER DEFAULT 0,
  movement_days_confirmed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_presence_at TIMESTAMPTZ,
  last_movement_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

-- Presence log
CREATE TABLE presence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT REFERENCES device_tokens(device_token) ON DELETE CASCADE,
  location_hash TEXT NOT NULL,
  wifi_hash TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movement log
CREATE TABLE movement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT REFERENCES device_tokens(device_token) ON DELETE CASCADE,
  movement_date DATE NOT NULL,
  movement_detected BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(device_token, movement_date)
);

-- Badge seeds
CREATE TABLE badge_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT REFERENCES zones(zone_id),
  seed TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL
);

-- Blacklist
CREATE TABLE blacklist (
  device_fingerprint_hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  zone_id TEXT,
  blacklisted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incident reports (auto-expire in 24h)
CREATE TABLE incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT REFERENCES zones(zone_id),
  photo_encrypted TEXT,
  vehicle_color TEXT,
  vehicle_type TEXT,
  license_plate_encrypted TEXT,
  location_note TEXT,
  notes_encrypted TEXT,
  corroboration_count INTEGER DEFAULT 0,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Subsidy pool (per zone)
CREATE TABLE subsidy_pool (
  zone_id TEXT PRIMARY KEY REFERENCES zones(zone_id),
  balance DECIMAL(10,2) DEFAULT 0,
  total_contributed DECIMAL(10,2) DEFAULT 0,
  total_disbursed DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subsidy requests
CREATE TABLE subsidy_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT REFERENCES device_tokens(device_token) ON DELETE CASCADE,
  zone_id TEXT REFERENCES zones(zone_id),
  vouch_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'expired', 'activated')),
  qr_code_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Vouches
CREATE TABLE vouches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_device_token TEXT REFERENCES device_tokens(device_token),
  vouchee_device_token TEXT REFERENCES device_tokens(device_token),
  zone_id TEXT REFERENCES zones(zone_id),
  vouched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voucher_device_token, vouchee_device_token)
);

-- Rate limits
CREATE TABLE rate_limits (
  identifier TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  action_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW()
);

-- Temp device mapping (for webhook processing)
CREATE TABLE temp_device_mapping (
  session_id TEXT PRIMARY KEY,
  device_token TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_device_tokens_zone ON device_tokens(zone_id);
CREATE INDEX idx_device_tokens_status ON device_tokens(status);
CREATE INDEX idx_device_tokens_fingerprint ON device_tokens(device_fingerprint_hash);
CREATE INDEX idx_presence_log_device ON presence_log(device_token);
CREATE INDEX idx_presence_log_date ON presence_log(checked_at);
CREATE INDEX idx_movement_log_device ON movement_log(device_token);
CREATE INDEX idx_movement_log_date ON movement_log(movement_date);
CREATE INDEX idx_badge_seeds_zone ON badge_seeds(zone_id, valid_from, valid_until);
CREATE INDEX idx_incident_reports_zone ON incident_reports(zone_id);
CREATE INDEX idx_incident_reports_expiry ON incident_reports(expires_at);
CREATE INDEX idx_subsidy_requests_device ON subsidy_requests(device_token);
CREATE INDEX idx_vouches_vouchee ON vouches(vouchee_device_token);
CREATE INDEX idx_vouches_voucher ON vouches(voucher_device_token);

-- RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_device_mapping ENABLE ROW LEVEL SECURITY;

-- Server-only policies (all access through API, not direct client)
CREATE POLICY "Server only" ON device_tokens FOR ALL USING (false);
CREATE POLICY "Server only" ON presence_log FOR ALL USING (false);
CREATE POLICY "Server only" ON movement_log FOR ALL USING (false);
CREATE POLICY "Server only" ON badge_seeds FOR ALL USING (false);
CREATE POLICY "Server only" ON blacklist FOR ALL USING (false);
CREATE POLICY "Server only" ON incident_reports FOR ALL USING (false);
CREATE POLICY "Server only" ON subsidy_pool FOR ALL USING (false);
CREATE POLICY "Server only" ON subsidy_requests FOR ALL USING (false);
CREATE POLICY "Server only" ON vouches FOR ALL USING (false);
CREATE POLICY "Server only" ON rate_limits FOR ALL USING (false);
CREATE POLICY "Server only" ON temp_device_mapping FOR ALL USING (false);

-- Public zone info
CREATE POLICY "Public read zones" ON zones FOR SELECT USING (true);

-- Helper functions
CREATE OR REPLACE FUNCTION increment_zone_residents(zone TEXT)
RETURNS void AS $$
BEGIN
  UPDATE zones SET active_resident_count = active_resident_count + 1 WHERE zone_id = zone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_zone_residents(zone TEXT)
RETURNS void AS $$
BEGIN
  UPDATE zones SET active_resident_count = GREATEST(0, active_resident_count - 1) WHERE zone_id = zone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_corroboration(incident_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE incident_reports SET corroboration_count = corroboration_count + 1 WHERE id = incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_vouch_count(vouchee TEXT)
RETURNS void AS $$
BEGIN
  UPDATE subsidy_requests SET vouch_count = vouch_count + 1 WHERE device_token = vouchee AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_to_subsidy_pool(zone TEXT, contribution DECIMAL)
RETURNS void AS $$
BEGIN
  INSERT INTO subsidy_pool (zone_id, balance, total_contributed)
  VALUES (zone, contribution, contribution)
  ON CONFLICT (zone_id) DO UPDATE
  SET balance = subsidy_pool.balance + contribution,
      total_contributed = subsidy_pool.total_contributed + contribution,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed a test zone
INSERT INTO zones (zone_id, zone_name, zone_boundary_hashes, color_primary, color_secondary, color_accent, motion_pattern, active_resident_count)
VALUES (
  'demo-zone-001',
  'Maple Heights',
  ARRAY['a1b2c3d4e5', 'f6g7h8i9j0', 'k1l2m3n4o5'],
  '#1B365D',
  '#4A90D9',
  '#2ECC71',
  'wave',
  0
);

INSERT INTO subsidy_pool (zone_id, balance, total_contributed, total_disbursed)
VALUES ('demo-zone-001', 0, 0, 0);
