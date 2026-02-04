import { NextRequest, NextResponse } from 'next/server';
import { getDeviceToken, getCurrentBadgeSeed, createBadgeSeed } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters } from '@/lib/badge-seed';
import { requireActiveSubscription } from '@/lib/subscription-guard';

export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
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

    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (device.status === 'revoked' || device.status === 'frozen') {
      return NextResponse.json({ error: 'Device is not active', status: device.status }, { status: 403 });
    }

    const zoneId = device.zone_id;

    let seedData = await getCurrentBadgeSeed(zoneId);

    if (!seedData) {
      const newSeed = generateCurrentSeed(zoneId);
      await createBadgeSeed(zoneId, newSeed.seed, newSeed.validFrom, newSeed.validUntil);
      seedData = {
        zone_id: zoneId,
        seed: newSeed.seed,
        valid_from: newSeed.validFrom.toISOString(),
        valid_until: newSeed.validUntil.toISOString(),
      };
    }

    const animationParams = getAnimationParameters(seedData.seed, deviceToken);

    return NextResponse.json({
      seed: seedData.seed,
      validFrom: seedData.valid_from,
      validUntil: seedData.valid_until,
      params: animationParams,
      zone: device.zones,
      status: device.status,
      isSubsidized: device.subscription_type === 'subsidized',
      nightsConfirmed: device.nights_confirmed,
      movementDaysConfirmed: device.movement_days_confirmed,
      verificationStartDate: device.verification_start_date,
    });
  } catch (error) {
    console.error('Badge seed error:', error);
    return NextResponse.json({ error: 'Failed to get badge seed' }, { status: 500 });
  }
}
