import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { getZoneById, getZoneByH3Index, getOrCreateH3Zone, isBlacklisted } from '@/lib/supabase';
import { generateZoneAppearance } from '@/lib/h3-zones';
import { getZoneNameSafe } from '@/lib/nominatim';

export async function POST(request: NextRequest) {
  try {
    const { zoneId, deviceFingerprintHash, h3Index, lat, lon } = await request.json();

    if (!deviceFingerprintHash) {
      return NextResponse.json({ error: 'Missing device fingerprint' }, { status: 400 });
    }

    // Need either zoneId (legacy) or h3Index (new H3 system)
    if (!zoneId && !h3Index) {
      return NextResponse.json({ error: 'Missing zone identifier' }, { status: 400 });
    }

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
      // First check if zone already exists
      zone = await getZoneByH3Index(h3Index);

      if (!zone) {
        // Need lat/lon to get zone name for new H3 zones
        if (typeof lat !== 'number' || typeof lon !== 'number') {
          return NextResponse.json(
            { error: 'Coordinates required for new zone creation' },
            { status: 400 }
          );
        }

        // Get zone name from Nominatim
        const zoneName = await getZoneNameSafe(h3Index, lat, lon);

        // Generate deterministic appearance
        const appearance = generateZoneAppearance(h3Index);

        // Create the zone
        zone = await getOrCreateH3Zone(
          h3Index,
          zoneName,
          appearance.color_primary,
          appearance.color_secondary,
          appearance.color_accent,
          appearance.motion_pattern
        );
      }
    } else {
      // Legacy zone lookup by zoneId
      zone = await getZoneById(zoneId);
      if (!zone) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}&zone_id=${zone.zone_id}&fingerprint=${deviceFingerprintHash}`;
    const cancelUrl = `${baseUrl}?zone_id=${zone.zone_id}`;

    const session = await createCheckoutSession(zone.zone_id, zone.zone_name, successUrl, cancelUrl);

    return NextResponse.json({ sessionUrl: session.url });
  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
