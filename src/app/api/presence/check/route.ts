import { NextRequest, NextResponse } from 'next/server';
import { supabase, logPresence, getDeviceToken } from '@/lib/supabase';
import { isLocationInH3Zone, getH3ZoneId } from '@/lib/h3-zones';
import { requireActiveSubscription } from '@/lib/subscription-guard';

export async function POST(request: NextRequest) {
  try {
    const { deviceToken, locationHash, wifiHash, lat, lon } = await request.json();

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    // Verify subscription
    const { authorized, status, error: paywallError } = await requireActiveSubscription(deviceToken);
    if (!authorized) {
      return NextResponse.json({
        error: paywallError,
        paywall: true,
        subscriptionStatus: status
      }, { status: 402 });
    }

    // Need either locationHash (legacy) or lat/lon (H3 system)
    if (!locationHash && (typeof lat !== 'number' || typeof lon !== 'number')) {
      return NextResponse.json({ error: 'Missing location data' }, { status: 400 });
    }

    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (device.status === 'revoked' || device.status === 'frozen') {
      return NextResponse.json({ error: 'Device is not active' }, { status: 403 });
    }

    const zone = device.zones;
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    let isInZone = false;

    // Determine if user is in zone using appropriate method
    if (zone.h3_index && typeof lat === 'number' && typeof lon === 'number') {
      // H3-based zone: check if user's H3 cell matches zone's H3 cell
      isInZone = isLocationInH3Zone(lat, lon, zone.h3_index);
    } else if (zone.zone_boundary_hashes && locationHash) {
      // Legacy zone: check if locationHash is in zone_boundary_hashes array
      isInZone = zone.zone_boundary_hashes.includes(locationHash);
    }

    // Generate a location hash for logging if we have lat/lon
    const logLocationHash = locationHash || (lat && lon ? getH3ZoneId(lat, lon) : 'unknown');
    await logPresence(deviceToken, logLocationHash, wifiHash, isInZone);

    if (isInZone) {
      const { error: updateError } = await supabase
        .from('device_tokens')
        .update({
          nights_confirmed: device.nights_confirmed + 1,
          last_presence_at: new Date().toISOString(),
        })
        .eq('device_token', deviceToken);

      if (updateError) {
        console.error('Failed to update nights:', updateError);
      }

      if (device.status === 'verifying' && device.nights_confirmed + 1 >= 14 && device.movement_days_confirmed >= 10) {
        await supabase
          .from('device_tokens')
          .update({ status: 'active' })
          .eq('device_token', deviceToken);

        await supabase.rpc('increment_zone_residents', { zone: device.zone_id });
      }
    }

    return NextResponse.json({
      confirmed: isInZone,
      nightsConfirmed: isInZone ? device.nights_confirmed + 1 : device.nights_confirmed,
    });
  } catch (error) {
    console.error('Presence check error:', error);
    return NextResponse.json({ error: 'Failed to check presence' }, { status: 500 });
  }
}
