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
function checkDemoZonesMatch(colorSignature: number[]): typeof DEMO_ZONES[0] | null {
  for (const demoZone of DEMO_ZONES) {
    const primaryRGB = hexToRgb(demoZone.color_primary);
    const secondaryRGB = hexToRgb(demoZone.color_secondary);

    if (!primaryRGB || !secondaryRGB) continue;

    let primaryMatch = 0;
    let secondaryMatch = 0;
    let dominantColorPixels = 0;

    for (let i = 0; i < colorSignature.length; i += 3) {
      const r = colorSignature[i];
      const g = colorSignature[i + 1];
      const b = colorSignature[i + 2];

      // Check for primary color
      const primaryDist = Math.sqrt(
        Math.pow(r - primaryRGB.r, 2) +
        Math.pow(g - primaryRGB.g, 2) +
        Math.pow(b - primaryRGB.b, 2)
      );
      if (primaryDist < 80) primaryMatch++;

      // Check for secondary color
      const secondaryDist = Math.sqrt(
        Math.pow(r - secondaryRGB.r, 2) +
        Math.pow(g - secondaryRGB.g, 2) +
        Math.pow(b - secondaryRGB.b, 2)
      );
      if (secondaryDist < 80) secondaryMatch++;

      // Check if pixel matches general color family of this zone
      // Determine dominant channel of the zone's colors
      const zoneDominant = getDominantChannel(primaryRGB);
      if (isDominantMatch(r, g, b, zoneDominant)) {
        dominantColorPixels++;
      }
    }

    const totalSamples = colorSignature.length / 3;
    const primaryRatio = primaryMatch / totalSamples;
    const secondaryRatio = secondaryMatch / totalSamples;
    const dominantRatio = dominantColorPixels / totalSamples;

    // Match if we have significant colors matching this zone's badge
    const hasColorMatch = (primaryRatio > 0.1 || secondaryRatio > 0.1);
    const hasDominantPresence = dominantRatio > 0.25;

    if (hasColorMatch && hasDominantPresence) {
      return demoZone;
    }
  }

  return null;
}

// Get the dominant color channel for a color
function getDominantChannel(rgb: { r: number; g: number; b: number }): 'r' | 'g' | 'b' {
  if (rgb.r >= rgb.g && rgb.r >= rgb.b) return 'r';
  if (rgb.g >= rgb.r && rgb.g >= rgb.b) return 'g';
  return 'b';
}

// Check if a pixel has the same dominant channel
function isDominantMatch(r: number, g: number, b: number, dominant: 'r' | 'g' | 'b'): boolean {
  const threshold = 1.1; // 10% higher than others
  switch (dominant) {
    case 'r': return r > g * threshold && r > b * threshold && r > 50;
    case 'g': return g > r * threshold && g > b * threshold && g > 50;
    case 'b': return b > r * threshold && b > g * 0.9 && b > 50;
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
