import { createClient } from '@supabase/supabase-js';
import type { Zone } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function getZoneByLocationHash(locationHash: string) {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .contains('zone_boundary_hashes', [locationHash])
    .single();

  if (error) return null;
  return data;
}

export async function getZoneById(zoneId: string) {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('zone_id', zoneId)
    .single();

  if (error) return null;
  return data;
}

export async function createDeviceToken(data: {
  device_token: string;
  device_fingerprint_hash: string;
  zone_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_type: 'paid' | 'subsidized';
}) {
  const { data: result, error } = await supabase
    .from('device_tokens')
    .insert({
      ...data,
      status: 'verifying',
      verification_start_date: new Date().toISOString().split('T')[0],
      nights_confirmed: 0,
      movement_days_confirmed: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getDeviceToken(token: string) {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*, zones(*)')
    .eq('device_token', token)
    .single();

  if (error) return null;
  return data;
}

export async function updateDeviceStatus(token: string, status: string) {
  const { error } = await supabase
    .from('device_tokens')
    .update({ status, deactivated_at: status === 'revoked' ? new Date().toISOString() : null })
    .eq('device_token', token);

  if (error) throw error;
}

export async function incrementNightsConfirmed(token: string) {
  const { data, error } = await supabase.rpc('increment_nights', { token_id: token });
  if (error) throw error;
  return data;
}

export async function incrementMovementDays(token: string) {
  const { data, error } = await supabase.rpc('increment_movement', { token_id: token });
  if (error) throw error;
  return data;
}

export async function isBlacklisted(fingerprintHash: string): Promise<boolean> {
  const { data } = await supabase
    .from('blacklist')
    .select('device_fingerprint_hash')
    .eq('device_fingerprint_hash', fingerprintHash)
    .single();

  return data !== null;
}

export async function addToBlacklist(fingerprintHash: string, reason: string, zoneId?: string) {
  const { error } = await supabase
    .from('blacklist')
    .insert({
      device_fingerprint_hash: fingerprintHash,
      reason,
      zone_id: zoneId,
    });

  if (error) throw error;
}

export async function logPresence(deviceToken: string, locationHash: string, wifiHash: string | null, confirmed: boolean) {
  const { error } = await supabase
    .from('presence_log')
    .insert({
      device_token: deviceToken,
      location_hash: locationHash,
      wifi_hash: wifiHash,
      confirmed,
    });

  if (error) throw error;
}

export async function logMovement(
  deviceToken: string,
  date: string,
  detected: boolean,
  lat?: number,
  lon?: number
) {
  // Compute H3 index if lat/lon provided
  let h3Index: string | null = null;
  if (typeof lat === 'number' && typeof lon === 'number') {
    try {
      const h3 = await import('h3-js');
      h3Index = h3.latLngToCell(lat, lon, 7); // Resolution 7 for ~5km precision
    } catch {
      // H3 import failed, continue without index
    }
  }

  const { error } = await supabase
    .from('movement_log')
    .upsert({
      device_token: deviceToken,
      movement_date: date,
      movement_detected: detected,
      checked_at: new Date().toISOString(),
      lat: lat ?? null,
      lon: lon ?? null,
      h3_index: h3Index,
    }, { onConflict: 'device_token,movement_date' });

  if (error) throw error;
}

export async function getCurrentBadgeSeed(zoneId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('badge_seeds')
    .select('*')
    .eq('zone_id', zoneId)
    .lte('valid_from', now)
    .gte('valid_until', now)
    .order('valid_from', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function createBadgeSeed(zoneId: string, seed: string, validFrom: Date, validUntil: Date) {
  const { error } = await supabase
    .from('badge_seeds')
    .insert({
      zone_id: zoneId,
      seed,
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
    });

  if (error) throw error;
}

export async function createIncidentReport(data: {
  zone_id: string;
  photo_encrypted?: string;
  vehicle_color?: string;
  vehicle_type?: string;
  license_plate_encrypted?: string;
  location_note?: string;
  notes_encrypted?: string;
}) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: result, error } = await supabase
    .from('incident_reports')
    .insert({
      ...data,
      expires_at: expiresAt,
      corroboration_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getActiveIncidents(zoneId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .eq('zone_id', zoneId)
    .gte('expires_at', now)
    .order('reported_at', { ascending: false });

  if (error) return [];
  return data;
}

export async function incrementCorroboration(incidentId: string) {
  const { error } = await supabase.rpc('increment_corroboration', { incident_id: incidentId });
  if (error) throw error;
}

export async function getSubsidyPool(zoneId: string) {
  const { data, error } = await supabase
    .from('subsidy_pool')
    .select('*')
    .eq('zone_id', zoneId)
    .single();

  if (error) return null;
  return data;
}

export async function contributeToSubsidyPool(zoneId: string, amount: number) {
  const { error } = await supabase.rpc('add_to_subsidy_pool', {
    zone: zoneId,
    contribution: amount
  });
  if (error) throw error;
}

export async function createSubsidyRequest(deviceToken: string, zoneId: string, qrCodeData: string) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('subsidy_requests')
    .insert({
      device_token: deviceToken,
      zone_id: zoneId,
      qr_code_data: qrCodeData,
      vouch_count: 0,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSubsidyRequest(deviceToken: string) {
  const { data, error } = await supabase
    .from('subsidy_requests')
    .select('*')
    .eq('device_token', deviceToken)
    .eq('status', 'pending')
    .single();

  if (error) return null;
  return data;
}

export async function recordVouch(voucherToken: string, voucheeToken: string, zoneId: string) {
  const { error: vouchError } = await supabase
    .from('vouches')
    .insert({
      voucher_device_token: voucherToken,
      vouchee_device_token: voucheeToken,
      zone_id: zoneId,
    });

  if (vouchError) throw vouchError;

  const { error: updateError } = await supabase.rpc('increment_vouch_count', {
    vouchee: voucheeToken
  });
  if (updateError) throw updateError;
}

export async function getVouchCount(voucherToken: string): Promise<number> {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { count, error } = await supabase
    .from('vouches')
    .select('*', { count: 'exact', head: true })
    .eq('voucher_device_token', voucherToken)
    .gte('vouched_at', yearStart)
    .lte('vouched_at', yearEnd);

  if (error) return 0;
  return count || 0;
}

export async function hasVouchedFor(voucherToken: string, voucheeToken: string): Promise<boolean> {
  const { data } = await supabase
    .from('vouches')
    .select('id')
    .eq('voucher_device_token', voucherToken)
    .eq('vouchee_device_token', voucheeToken)
    .single();

  return data !== null;
}

export async function getAllZones() {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .order('zone_name');

  if (error) return [];
  return data;
}

export async function updateZoneResidentCount(zoneId: string) {
  const { count } = await supabase
    .from('device_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('zone_id', zoneId)
    .eq('status', 'active');

  await supabase
    .from('zones')
    .update({ active_resident_count: count || 0 })
    .eq('zone_id', zoneId);
}

export async function getZoneByH3Index(h3Index: string): Promise<Zone | null> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('h3_index', h3Index)
    .single();

  if (error) return null;
  return data;
}

export async function getOrCreateH3Zone(
  h3Index: string,
  zoneName: string,
  colorPrimary: string,
  colorSecondary: string,
  colorAccent: string,
  motionPattern: string
): Promise<Zone> {
  // First check if zone exists
  const existing = await getZoneByH3Index(h3Index);
  if (existing) return existing;

  const zoneId = `h3-${h3Index}`;

  // Create the zone directly
  const { data: zone, error: zoneError } = await supabase
    .from('zones')
    .insert({
      zone_id: zoneId,
      zone_name: zoneName,
      zone_boundary_hashes: null,
      h3_index: h3Index,
      h3_resolution: 4,
      color_primary: colorPrimary,
      color_secondary: colorSecondary,
      color_accent: colorAccent,
      motion_pattern: motionPattern,
      active_resident_count: 0,
    })
    .select()
    .single();

  if (zoneError) throw zoneError;

  // Create subsidy pool for new zone
  await supabase
    .from('subsidy_pool')
    .insert({
      zone_id: zoneId,
      balance: 0,
      total_contributed: 0,
      total_disbursed: 0,
    })
    .select()
    .single();

  return zone;
}
