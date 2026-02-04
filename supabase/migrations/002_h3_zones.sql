-- H3 Zone Grid System Migration
-- Adds H3 hexagonal grid support for automatic zone creation

-- Add H3 fields to zones table
ALTER TABLE zones ADD COLUMN IF NOT EXISTS h3_index TEXT;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS h3_resolution INTEGER DEFAULT 4;

-- Create unique index for H3 lookups (only for H3-based zones)
CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_h3 ON zones(h3_index) WHERE h3_index IS NOT NULL;

-- Make boundary hashes nullable (H3 zones don't need them)
ALTER TABLE zones ALTER COLUMN zone_boundary_hashes DROP NOT NULL;

-- Cache table for Nominatim reverse geocoding results
CREATE TABLE IF NOT EXISTS zone_name_cache (
  h3_index TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  neighborhood TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache freshness queries
CREATE INDEX IF NOT EXISTS idx_zone_name_cache_cached_at ON zone_name_cache(cached_at);

-- Enable RLS on cache table
ALTER TABLE zone_name_cache ENABLE ROW LEVEL SECURITY;

-- Server-only policy for cache table
CREATE POLICY "Server only" ON zone_name_cache FOR ALL USING (false);

-- Function to get or create an H3 zone
CREATE OR REPLACE FUNCTION get_or_create_h3_zone(
  p_h3_index TEXT,
  p_zone_name TEXT,
  p_color_primary TEXT,
  p_color_secondary TEXT,
  p_color_accent TEXT,
  p_motion_pattern TEXT
)
RETURNS zones AS $$
DECLARE
  v_zone zones;
  v_zone_id TEXT;
BEGIN
  -- Check if zone already exists
  SELECT * INTO v_zone FROM zones WHERE h3_index = p_h3_index;

  IF FOUND THEN
    RETURN v_zone;
  END IF;

  -- Generate a unique zone_id from the H3 index
  v_zone_id := 'h3-' || p_h3_index;

  -- Create new zone
  INSERT INTO zones (
    zone_id,
    zone_name,
    zone_boundary_hashes,
    h3_index,
    h3_resolution,
    color_primary,
    color_secondary,
    color_accent,
    motion_pattern,
    active_resident_count
  ) VALUES (
    v_zone_id,
    p_zone_name,
    NULL, -- H3 zones don't use boundary hashes
    p_h3_index,
    4, -- Resolution 4 for ~30x30 mile zones
    p_color_primary,
    p_color_secondary,
    p_color_accent,
    p_motion_pattern,
    0
  )
  RETURNING * INTO v_zone;

  -- Create subsidy pool for new zone
  INSERT INTO subsidy_pool (zone_id, balance, total_contributed, total_disbursed)
  VALUES (v_zone_id, 0, 0, 0)
  ON CONFLICT (zone_id) DO NOTHING;

  RETURN v_zone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
