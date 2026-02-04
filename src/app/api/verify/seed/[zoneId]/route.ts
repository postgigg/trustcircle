import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBadgeSeed, createBadgeSeed, getZoneById } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters } from '@/lib/badge-seed';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;

    const zone = await getZoneById(zoneId);
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

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

    const animationParams = getAnimationParameters(seedData.seed);

    return NextResponse.json({
      seed: seedData.seed,
      validFrom: seedData.valid_from,
      validUntil: seedData.valid_until,
      params: animationParams,
      zone: {
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        color_primary: zone.color_primary,
        color_secondary: zone.color_secondary,
        color_accent: zone.color_accent,
        motion_pattern: zone.motion_pattern,
      },
    });
  } catch (error) {
    console.error('Verify seed error:', error);
    return NextResponse.json({ error: 'Failed to get verification seed' }, { status: 500 });
  }
}
