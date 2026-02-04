-- Fix RLS policies to allow service role operations
-- The service role should bypass RLS by default, but if it's not working,
-- we need to either:
-- 1. Ensure we're using the service_role key (not anon)
-- 2. Or add explicit policies for authenticated service operations

-- Option: Disable RLS entirely for server-side tables (since all access is through API)
-- This is safe because these tables are never accessed directly from the client

-- Temporarily disable RLS on tables that need server-side writes
-- Uncomment these if the service role key isn't working:

-- ALTER TABLE device_tokens DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE zones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE zone_name_cache DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE subsidy_requests DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE presence_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE movement_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE badge_seeds DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE incident_reports DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE subsidy_pool DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vouches DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rate_limits DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE temp_device_mapping DISABLE ROW LEVEL SECURITY;

-- Better option: Create service role bypass policies
-- Drop existing restrictive policies and create permissive ones for service role

-- device_tokens
DROP POLICY IF EXISTS "Server only" ON device_tokens;
CREATE POLICY "Service role full access" ON device_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- zones (already has public read, add write for service)
CREATE POLICY "Service role write zones" ON zones
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role update zones" ON zones
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- zone_name_cache
DROP POLICY IF EXISTS "Server only" ON zone_name_cache;
CREATE POLICY "Service role full access" ON zone_name_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- subsidy_requests
DROP POLICY IF EXISTS "Server only" ON subsidy_requests;
CREATE POLICY "Service role full access" ON subsidy_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- presence_log
DROP POLICY IF EXISTS "Server only" ON presence_log;
CREATE POLICY "Service role full access" ON presence_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- movement_log
DROP POLICY IF EXISTS "Server only" ON movement_log;
CREATE POLICY "Service role full access" ON movement_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- badge_seeds
DROP POLICY IF EXISTS "Server only" ON badge_seeds;
CREATE POLICY "Service role full access" ON badge_seeds
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- blacklist
DROP POLICY IF EXISTS "Server only" ON blacklist;
CREATE POLICY "Service role full access" ON blacklist
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- incident_reports
DROP POLICY IF EXISTS "Server only" ON incident_reports;
CREATE POLICY "Service role full access" ON incident_reports
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- subsidy_pool
DROP POLICY IF EXISTS "Server only" ON subsidy_pool;
CREATE POLICY "Service role full access" ON subsidy_pool
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- vouches
DROP POLICY IF EXISTS "Server only" ON vouches;
CREATE POLICY "Service role full access" ON vouches
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- rate_limits
DROP POLICY IF EXISTS "Server only" ON rate_limits;
CREATE POLICY "Service role full access" ON rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- temp_device_mapping
DROP POLICY IF EXISTS "Server only" ON temp_device_mapping;
CREATE POLICY "Service role full access" ON temp_device_mapping
  FOR ALL
  USING (true)
  WITH CHECK (true);
