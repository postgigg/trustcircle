import { NextRequest, NextResponse } from 'next/server';
import { createSubsidyRequest, getSubsidyRequest, isBlacklisted, getZoneById, getZoneByH3Index, getOrCreateH3Zone, createDeviceToken } from '@/lib/supabase';
import { sha256 } from '@/lib/crypto';
import { generateZoneAppearance } from '@/lib/h3-zones';
import { getZoneNameSafe } from '@/lib/nominatim';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const { zoneId, h3Index, lat, lon, deviceFingerprintHash } = await request.json();

    console.log('Subsidy request received:', { zoneId, h3Index, lat, lon, hasFingerprint: !!deviceFingerprintHash });

    if (!deviceFingerprintHash) {
      return NextResponse.json({ error: 'Missing device fingerprint' }, { status: 400 });
    }

    // Need either zoneId (legacy) or h3Index (new H3 system)
    if (!zoneId && !h3Index) {
      return NextResponse.json({ error: 'Missing zone identifier' }, { status: 400 });
    }

    console.log('Checking blacklist...');
    const blacklisted = await isBlacklisted(deviceFingerprintHash);
    if (blacklisted) {
      return NextResponse.json(
        { error: 'This device has been restricted from TrustCircle.' },
        { status: 403 }
      );
    }

    let zone;

    // Handle H3-based zone creation
    if (h3Index) {
      console.log('Looking up H3 zone:', h3Index);
      // First check if zone already exists
      zone = await getZoneByH3Index(h3Index);
      console.log('Existing zone found:', !!zone);

      if (!zone) {
        // Need lat/lon to get zone name for new H3 zones
        if (typeof lat !== 'number' || typeof lon !== 'number') {
          return NextResponse.json(
            { error: 'Coordinates required for new zone creation' },
            { status: 400 }
          );
        }

        console.log('Getting zone name from Nominatim...');
        // Get zone name from Nominatim
        const zoneName = await getZoneNameSafe(h3Index, lat, lon);
        console.log('Zone name:', zoneName);

        // Generate deterministic appearance
        const appearance = generateZoneAppearance(h3Index);
        console.log('Zone appearance generated');

        console.log('Creating zone via RPC...');
        // Create the zone
        zone = await getOrCreateH3Zone(
          h3Index,
          zoneName,
          appearance.color_primary,
          appearance.color_secondary,
          appearance.color_accent,
          appearance.motion_pattern
        );
        console.log('Zone created:', zone?.zone_id);
      }
    } else {
      // Legacy zone lookup by zoneId
      console.log('Looking up legacy zone:', zoneId);
      zone = await getZoneById(zoneId);
      if (!zone) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
      }
    }

    console.log('Creating device token...');
    const deviceToken = sha256(`${deviceFingerprintHash}:${Date.now()}:${uuidv4()}`);

    await createDeviceToken({
      device_token: deviceToken,
      device_fingerprint_hash: deviceFingerprintHash,
      zone_id: zone.zone_id,
      subscription_type: 'subsidized',
    });
    console.log('Device token created');

    const existingRequest = await getSubsidyRequest(deviceToken);
    if (existingRequest) {
      return NextResponse.json({
        requestId: existingRequest.request_id,
        qrData: existingRequest.qr_code_data,
        vouchCount: existingRequest.vouch_count,
        expiresAt: existingRequest.expires_at,
        deviceToken,
      });
    }

    console.log('Creating subsidy request...');
    const qrData = JSON.stringify({
      type: 'tc_vouch',
      deviceToken,
      zoneId: zone.zone_id,
      requestId: uuidv4(),
    });

    const subsidyRequest = await createSubsidyRequest(deviceToken, zone.zone_id, qrData);
    console.log('Subsidy request created');

    return NextResponse.json({
      requestId: subsidyRequest.request_id,
      qrData: subsidyRequest.qr_code_data,
      vouchCount: 0,
      expiresAt: subsidyRequest.expires_at,
      deviceToken,
    });
  } catch (error: unknown) {
    console.error('Subsidy request error:', error);
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
      console.error('Error stack:', error.stack);
    } else if (error && typeof error === 'object') {
      message = JSON.stringify(error);
    } else if (typeof error === 'string') {
      message = error;
    }
    return NextResponse.json({ error: 'Failed to create subsidy request', details: message }, { status: 500 });
  }
}
