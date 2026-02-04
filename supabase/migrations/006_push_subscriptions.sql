-- Push Notifications Infrastructure
-- Migration 006: Add push subscription storage and notification logging

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT REFERENCES device_tokens(device_token) ON DELETE CASCADE,
  zone_id TEXT REFERENCES zones(zone_id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_token, endpoint)
);

-- Notification log for auditing
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id TEXT,
  notification_type TEXT NOT NULL,
  payload JSONB,
  recipients_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_zone ON push_subscriptions(zone_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device ON push_subscriptions(device_token);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_log_zone ON notification_log(zone_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent ON notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log(notification_type);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Server-only policies
CREATE POLICY "Server only" ON push_subscriptions FOR ALL USING (false);
CREATE POLICY "Server only" ON notification_log FOR ALL USING (false);

-- Helper function: Deactivate a push subscription (on failure)
CREATE OR REPLACE FUNCTION deactivate_push_subscription(p_endpoint TEXT)
RETURNS void AS $$
BEGIN
  UPDATE push_subscriptions
  SET is_active = false, updated_at = NOW()
  WHERE endpoint = p_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Increment failed count for a subscription
CREATE OR REPLACE FUNCTION increment_subscription_failed(p_endpoint TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE push_subscriptions
  SET failed_count = failed_count + 1, updated_at = NOW()
  WHERE endpoint = p_endpoint
  RETURNING failed_count INTO v_new_count;

  -- Auto-deactivate after 3 failures
  IF v_new_count >= 3 THEN
    PERFORM deactivate_push_subscription(p_endpoint);
  END IF;

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get active subscriptions for a zone
CREATE OR REPLACE FUNCTION get_zone_subscriptions(p_zone_id TEXT)
RETURNS TABLE (
  endpoint TEXT,
  p256dh TEXT,
  auth TEXT,
  device_token TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT ps.endpoint, ps.p256dh, ps.auth, ps.device_token
  FROM push_subscriptions ps
  WHERE ps.zone_id = p_zone_id
    AND ps.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Log a notification send
CREATE OR REPLACE FUNCTION log_notification(
  p_zone_id TEXT,
  p_type TEXT,
  p_payload JSONB,
  p_recipients INTEGER,
  p_failed INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notification_log (zone_id, notification_type, payload, recipients_count, failed_count)
  VALUES (p_zone_id, p_type, p_payload, p_recipients, p_failed)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
