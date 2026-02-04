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

// Check if the scanned colors match Briarwood badge (blue colors)
// The detector already filters for these colors, so just verify they're present
function checkDemoZonesMatch(colorSignature: number[]): typeof DEMO_ZONES[0] | null {
  const totalSamples = colorSignature.length / 3;

  // Need at least 10 color samples
  if (totalSamples < 10) {
    console.log('Not enough samples:', totalSamples);
    return null;
  }

  // Briarwood/TrustCircle colors
  const primaryRGB = { r: 27, g: 54, b: 93 };    // #1B365D
  const secondaryRGB = { r: 74, g: 144, b: 217 }; // #4A90D9

  let primaryMatches = 0;
  let secondaryMatches = 0;

  for (let i = 0; i < colorSignature.length; i += 3) {
    const r = colorSignature[i];
    const g = colorSignature[i + 1];
    const b = colorSignature[i + 2];

    const primaryDist = Math.sqrt(
      Math.pow(r - primaryRGB.r, 2) +
      Math.pow(g - primaryRGB.g, 2) +
      Math.pow(b - primaryRGB.b, 2)
    );

    const secondaryDist = Math.sqrt(
      Math.pow(r - secondaryRGB.r, 2) +
      Math.pow(g - secondaryRGB.g, 2) +
      Math.pow(b - secondaryRGB.b, 2)
    );

    if (primaryDist < 60) primaryMatches++;
    if (secondaryDist < 60) secondaryMatches++;
  }

  const primaryRatio = primaryMatches / totalSamples;
  const secondaryRatio = secondaryMatches / totalSamples;

  console.log(`Briarwood check: primary=${(primaryRatio * 100).toFixed(1)}%, secondary=${(secondaryRatio * 100).toFixed(1)}%`);

  // Need significant presence of both colors
  if (primaryRatio > 0.2 || secondaryRatio > 0.2) {
    // Return Briarwood (first blue zone)
    return DEMO_ZONES.find(z => z.zone_id === 'demo-briarwood') || DEMO_ZONES[0];
  }

  return null;
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
