import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters, verifySeedMatch } from '@/lib/badge-seed';

// Demo zones for testing - can be viewed without PWA
const DEMO_ZONES = [
  {
    zone_id: 'demo-trustcircle',
    zone_name: 'TrustCircle Demo',
    color_primary: '#1B365D',
    color_secondary: '#4A90D9',
  },
  {
    zone_id: 'demo-briarwood',
    zone_name: 'Briarwood',
    color_primary: '#1B365D',
    color_secondary: '#4A90D9',
  },
  {
    zone_id: 'demo-oakridge',
    zone_name: 'Oak Ridge',
    color_primary: '#2D5016',
    color_secondary: '#6B8E23',
  },
  {
    zone_id: 'demo-riverside',
    zone_name: 'Riverside',
    color_primary: '#1A4D5C',
    color_secondary: '#4ECDC4',
  },
  {
    zone_id: 'demo-maplewood',
    zone_name: 'Maplewood',
    color_primary: '#8B4513',
    color_secondary: '#D2691E',
  },
];

export async function POST(request: NextRequest) {
  try {
    const { colorSignature, timestamp } = await request.json();

    if (!colorSignature || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // First check demo zones (landing page badge and /demo/* routes)
    const matchedDemoZone = checkDemoZonesMatch(colorSignature);
    if (matchedDemoZone) {
      return NextResponse.json({
        verified: true,
        zoneName: matchedDemoZone.zone_name,
        zoneId: matchedDemoZone.zone_id,
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

// Check if the scanned colors match any demo zone badge
// Returns the BEST matching zone, not just the first match
function checkDemoZonesMatch(colorSignature: number[]): typeof DEMO_ZONES[0] | null {
  const totalSamples = colorSignature.length / 3;
  if (totalSamples === 0) return null;

  let bestZone: typeof DEMO_ZONES[0] | null = null;
  let bestScore = 0;

  for (const demoZone of DEMO_ZONES) {
    const primaryRGB = hexToRgb(demoZone.color_primary);
    const secondaryRGB = hexToRgb(demoZone.color_secondary);

    if (!primaryRGB || !secondaryRGB) continue;

    let totalDistance = 0;
    let matchingPixels = 0;

    for (let i = 0; i < colorSignature.length; i += 3) {
      const r = colorSignature[i];
      const g = colorSignature[i + 1];
      const b = colorSignature[i + 2];

      // Calculate distance to primary color
      const primaryDist = Math.sqrt(
        Math.pow(r - primaryRGB.r, 2) +
        Math.pow(g - primaryRGB.g, 2) +
        Math.pow(b - primaryRGB.b, 2)
      );

      // Calculate distance to secondary color
      const secondaryDist = Math.sqrt(
        Math.pow(r - secondaryRGB.r, 2) +
        Math.pow(g - secondaryRGB.g, 2) +
        Math.pow(b - secondaryRGB.b, 2)
      );

      // Use the closer color match
      const minDist = Math.min(primaryDist, secondaryDist);

      // Count as matching if reasonably close (within 100 units)
      if (minDist < 100) {
        matchingPixels++;
        totalDistance += minDist;
      }
    }

    // Calculate score: more matching pixels + closer distances = higher score
    const matchRatio = matchingPixels / totalSamples;
    const avgDistance = matchingPixels > 0 ? totalDistance / matchingPixels : 255;

    // Score formula: match ratio weighted by inverse distance
    // Higher match ratio and lower distance = better score
    const score = matchRatio * (1 - avgDistance / 255);

    console.log(`Zone ${demoZone.zone_name}: matchRatio=${matchRatio.toFixed(2)}, avgDist=${avgDistance.toFixed(0)}, score=${score.toFixed(3)}`);

    // Need at least 15% of pixels to match
    if (matchRatio >= 0.15 && score > bestScore) {
      bestScore = score;
      bestZone = demoZone;
    }
  }

  console.log('Best match:', bestZone?.zone_name || 'none', 'score:', bestScore.toFixed(3));
  return bestZone;
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
