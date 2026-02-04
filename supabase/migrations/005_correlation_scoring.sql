-- Movement-Presence Correlation + Check-in Challenges
-- Migration 005: Add correlation scoring and random check-in system

-- Add timestamp + location to movement_log
ALTER TABLE movement_log ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE movement_log ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 7);
ALTER TABLE movement_log ADD COLUMN IF NOT EXISTS lon DECIMAL(10, 7);
ALTER TABLE movement_log ADD COLUMN IF NOT EXISTS h3_index TEXT;

-- Correlation scores table
CREATE TABLE IF NOT EXISTS correlation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT REFERENCES device_tokens(device_token) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  trust_score DECIMAL(3, 2) DEFAULT 1.00,
  flags JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_token, score_date)
);

-- Random check-in tracking
CREATE TABLE IF NOT EXISTS checkin_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT REFERENCES device_tokens(device_token) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  touch_data JSONB, -- { points: [{x,y,t}...], duration, straightness }
  is_human BOOLEAN,
  challenge_number INTEGER NOT NULL, -- 1, 2, or 3
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'expired', 'failed')),
  UNIQUE(device_token, challenge_number)
);

-- Add check-in count to device_tokens
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS checkins_completed INTEGER DEFAULT 0;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS checkins_required INTEGER DEFAULT 3;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_movement_log_checked_at ON movement_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_correlation_scores_device ON correlation_scores(device_token);
CREATE INDEX IF NOT EXISTS idx_correlation_scores_date ON correlation_scores(score_date);
CREATE INDEX IF NOT EXISTS idx_checkin_challenges_device ON checkin_challenges(device_token);
CREATE INDEX IF NOT EXISTS idx_checkin_challenges_scheduled ON checkin_challenges(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_checkin_challenges_status ON checkin_challenges(status);

-- RLS
ALTER TABLE correlation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_challenges ENABLE ROW LEVEL SECURITY;

-- Server-only policies
CREATE POLICY "Server only" ON correlation_scores FOR ALL USING (false);
CREATE POLICY "Server only" ON checkin_challenges FOR ALL USING (false);

-- Helper function: Calculate correlation score for a device on a given date
CREATE OR REPLACE FUNCTION calculate_correlation_score(
  p_device_token TEXT,
  p_date DATE
) RETURNS JSONB AS $$
DECLARE
  v_score DECIMAL(3,2) := 1.00;
  v_flags JSONB := '{}';
  v_impossible_trajectory BOOLEAN := false;
  v_stationary_movement BOOLEAN := false;
  v_nighttime_anomaly BOOLEAN := false;
  v_movement_record RECORD;
  v_presence_record RECORD;
  v_distance_miles DECIMAL;
  v_time_hours DECIMAL;
  v_speed_mph DECIMAL;
  v_same_location_count INTEGER;
BEGIN
  -- Get movement records for the date with location
  FOR v_movement_record IN
    SELECT lat, lon, checked_at, movement_detected, h3_index
    FROM movement_log
    WHERE device_token = p_device_token
      AND DATE(checked_at) = p_date
      AND lat IS NOT NULL
      AND lon IS NOT NULL
    ORDER BY checked_at
  LOOP
    -- Check 1: Impossible trajectory - compare with presence logs in last 2 hours
    FOR v_presence_record IN
      SELECT pl.location_hash, pl.checked_at
      FROM presence_log pl
      WHERE pl.device_token = p_device_token
        AND pl.checked_at < v_movement_record.checked_at
        AND pl.checked_at > v_movement_record.checked_at - INTERVAL '2 hours'
      ORDER BY pl.checked_at DESC
      LIMIT 5
    LOOP
      -- If we have H3 location data, we could compute distance
      -- For now, we'll rely on matching H3 indexes
      NULL; -- Placeholder for distance calculation
    END LOOP;

    -- Check 2: Stationary GPS + Movement detected
    IF v_movement_record.movement_detected THEN
      SELECT COUNT(*) INTO v_same_location_count
      FROM movement_log
      WHERE device_token = p_device_token
        AND h3_index = v_movement_record.h3_index
        AND movement_detected = true
        AND DATE(checked_at) >= p_date - INTERVAL '3 days';

      IF v_same_location_count >= 3 THEN
        v_stationary_movement := true;
        v_flags := v_flags || '{"stationary_with_movement": true}'::jsonb;
      END IF;
    END IF;

    -- Check 3: Movement during 2-5 AM
    IF v_movement_record.movement_detected AND
       EXTRACT(HOUR FROM v_movement_record.checked_at) BETWEEN 2 AND 5 THEN
      v_nighttime_anomaly := true;
      v_flags := v_flags || '{"nighttime_movement": true}'::jsonb;
    END IF;
  END LOOP;

  -- Calculate final score
  IF v_impossible_trajectory THEN
    v_score := v_score - 0.30;
  END IF;
  IF v_stationary_movement THEN
    v_score := v_score - 0.20;
  END IF;
  IF v_nighttime_anomaly THEN
    v_score := v_score - 0.10;
  END IF;

  -- Ensure score doesn't go below 0
  v_score := GREATEST(v_score, 0.00);

  -- Upsert the score
  INSERT INTO correlation_scores (device_token, score_date, trust_score, flags)
  VALUES (p_device_token, p_date, v_score, v_flags)
  ON CONFLICT (device_token, score_date)
  DO UPDATE SET trust_score = v_score, flags = v_flags, calculated_at = NOW();

  RETURN jsonb_build_object('score', v_score, 'flags', v_flags);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get average trust score for device over last N days
CREATE OR REPLACE FUNCTION get_average_trust_score(
  p_device_token TEXT,
  p_days INTEGER DEFAULT 14
) RETURNS DECIMAL(3,2) AS $$
DECLARE
  v_avg DECIMAL(3,2);
BEGIN
  SELECT COALESCE(AVG(trust_score), 1.00)
  INTO v_avg
  FROM correlation_scores
  WHERE device_token = p_device_token
    AND score_date >= CURRENT_DATE - p_days;

  RETURN v_avg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Increment check-ins completed
CREATE OR REPLACE FUNCTION increment_checkins(p_device_token TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE device_tokens
  SET checkins_completed = checkins_completed + 1
  WHERE device_token = p_device_token
  RETURNING checkins_completed INTO v_new_count;

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
