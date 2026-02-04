import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters, verifySeedMatch } from '@/lib/badge-seed';

// Demo zone for testing - matches the landing page badge colors
const DEMO_ZONE = {
  zone_id: 'demo-trustcircle',
  zone_name: 'TrustCircle Demo',
  color_primary: '#1B365D',
  color_secondary: '#4A90D9',
};

export async function POST(request: NextRequest) {
  try {
    const { colorSignature, timestamp } = await request.json();

    if (!colorSignature || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // First check demo zone (landing page badge)
    const demoMatch = checkDemoZoneMatch(colorSignature);
    if (demoMatch) {
      return NextResponse.json({
        verified: true,
        zoneName: DEMO_ZONE.zone_name,
        zoneId: DEMO_ZONE.zone_id,
        isDemo: true,
      });
    }

    // Then check database zones
    const { data: zones } = await supabase
      .from('zones')
      .select('*');

    if (zones && zones.length > 0) {
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
    }

    return NextResponse.json({ verified: false });
  } catch (error) {
    console.error('Verification check error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

// Check if the scanned colors match the demo zone badge
function checkDemoZoneMatch(colorSignature: number[]): boolean {
  const primaryRGB = { r: 27, g: 54, b: 93 };   // #1B365D
  const secondaryRGB = { r: 74, g: 144, b: 217 }; // #4A90D9

  let primaryMatch = 0;
  let secondaryMatch = 0;
  let blueishPixels = 0;

  for (let i = 0; i < colorSignature.length; i += 3) {
    const r = colorSignature[i];
    const g = colorSignature[i + 1];
    const b = colorSignature[i + 2];

    // Check for primary blue (dark navy)
    const primaryDist = Math.sqrt(
      Math.pow(r - primaryRGB.r, 2) +
      Math.pow(g - primaryRGB.g, 2) +
      Math.pow(b - primaryRGB.b, 2)
    );
    if (primaryDist < 80) primaryMatch++;

    // Check for secondary blue (lighter blue)
    const secondaryDist = Math.sqrt(
      Math.pow(r - secondaryRGB.r, 2) +
      Math.pow(g - secondaryRGB.g, 2) +
      Math.pow(b - secondaryRGB.b, 2)
    );
    if (secondaryDist < 80) secondaryMatch++;

    // Check if pixel is generally blue-ish (b > r and b > g)
    if (b > r && b > g * 0.8) {
      blueishPixels++;
    }
  }

  const totalSamples = colorSignature.length / 3;
  const primaryRatio = primaryMatch / totalSamples;
  const secondaryRatio = secondaryMatch / totalSamples;
  const blueRatio = blueishPixels / totalSamples;

  // Match if we have significant blue colors matching our badge
  // Either direct color matches OR general blue dominance
  const hasColorMatch = (primaryRatio > 0.1 || secondaryRatio > 0.1);
  const hasBluePresence = blueRatio > 0.3;

  return hasColorMatch && hasBluePresence;
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
