import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters, verifySeedMatch } from '@/lib/badge-seed';

export async function POST(request: NextRequest) {
  try {
    const { colorSignature, timestamp } = await request.json();

    if (!colorSignature || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: zones } = await supabase
      .from('zones')
      .select('*');

    if (!zones || zones.length === 0) {
      return NextResponse.json({ verified: false, error: 'No zones found' });
    }

    for (const zone of zones) {
      const currentSeed = generateCurrentSeed(zone.zone_id);
      const expectedParams = getAnimationParameters(currentSeed.seed);

      const capturedParams = extractParamsFromColors(colorSignature, zone);

      if (verifySeedMatch(capturedParams, expectedParams, 0.15)) {
        return NextResponse.json({
          verified: true,
          zoneName: zone.zone_name,
          zoneId: zone.zone_id,
        });
      }
    }

    return NextResponse.json({ verified: false });
  } catch (error) {
    console.error('Verification check error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

function extractParamsFromColors(
  colorSignature: number[],
  zone: { color_primary: string; color_secondary: string }
): {
  phaseOffset: number;
  speedMultiplier: number;
  colorIntensity: number;
  motionModifier: number;
} {
  const primaryRGB = hexToRgb(zone.color_primary);
  const secondaryRGB = hexToRgb(zone.color_secondary);

  let primaryMatch = 0;
  let secondaryMatch = 0;

  for (let i = 0; i < colorSignature.length; i += 3) {
    const r = colorSignature[i];
    const g = colorSignature[i + 1];
    const b = colorSignature[i + 2];

    if (primaryRGB) {
      const primaryDist = Math.sqrt(
        Math.pow(r - primaryRGB.r, 2) +
        Math.pow(g - primaryRGB.g, 2) +
        Math.pow(b - primaryRGB.b, 2)
      );
      if (primaryDist < 100) primaryMatch++;
    }

    if (secondaryRGB) {
      const secondaryDist = Math.sqrt(
        Math.pow(r - secondaryRGB.r, 2) +
        Math.pow(g - secondaryRGB.g, 2) +
        Math.pow(b - secondaryRGB.b, 2)
      );
      if (secondaryDist < 100) secondaryMatch++;
    }
  }

  const totalSamples = colorSignature.length / 3;
  const colorIntensity = (primaryMatch + secondaryMatch) / (totalSamples * 2);

  return {
    phaseOffset: primaryMatch / totalSamples,
    speedMultiplier: 0.9 + (secondaryMatch / totalSamples) * 0.2,
    colorIntensity,
    motionModifier: Math.abs(primaryMatch - secondaryMatch) / totalSamples,
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}
