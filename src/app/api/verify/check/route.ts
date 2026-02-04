import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters, verifySeedMatch } from '@/lib/badge-seed';

// Demo zones for testing - structured like real zones
const DEMO_ZONES = [
  {
    zone_id: 'demo-briarwood',
    zone_name: 'Briarwood',
    color_primary: '#1B365D',
    color_secondary: '#4A90D9',
    motion_pattern: 'wave',
  },
  {
    zone_id: 'demo-oakridge',
    zone_name: 'Oak Ridge',
    color_primary: '#2D5016',
    color_secondary: '#6B8E23',
    motion_pattern: 'ripple',
  },
  {
    zone_id: 'demo-riverside',
    zone_name: 'Riverside',
    color_primary: '#1A4D5C',
    color_secondary: '#4ECDC4',
    motion_pattern: 'pulse',
  },
  {
    zone_id: 'demo-maplewood',
    zone_name: 'Maplewood',
    color_primary: '#8B4513',
    color_secondary: '#D2691E',
    motion_pattern: 'spiral',
  },
];

export async function POST(request: NextRequest) {
  try {
    const { colorSignature, timestamp } = await request.json();

    if (!colorSignature || !Array.isArray(colorSignature) || colorSignature.length < 9) {
      return NextResponse.json({ error: 'Invalid color signature' }, { status: 400 });
    }

    // Find which zone's colors best match the signature
    const matchedZone = findMatchingZone(colorSignature);

    if (!matchedZone) {
      return NextResponse.json({ verified: false, reason: 'No matching zone colors' });
    }

    // For demo zones, just verify color match is strong enough
    if (matchedZone.isDemo) {
      return NextResponse.json({
        verified: true,
        zoneName: matchedZone.zone.zone_name,
        zoneId: matchedZone.zone.zone_id,
        isDemo: true,
        confidence: matchedZone.confidence,
      });
    }

    // For real zones, also verify the seed/animation parameters
    const currentSeed = generateCurrentSeed(matchedZone.zone.zone_id);
    const expectedParams = getAnimationParameters(currentSeed.seed);
    const capturedParams = extractParamsFromColors(colorSignature, matchedZone.zone);

    if (verifySeedMatch(capturedParams, expectedParams, 0.2)) {
      return NextResponse.json({
        verified: true,
        zoneName: matchedZone.zone.zone_name,
        zoneId: matchedZone.zone.zone_id,
        confidence: matchedZone.confidence,
      });
    }

    return NextResponse.json({ verified: false, reason: 'Animation parameters mismatch' });
  } catch (error) {
    console.error('Verification check error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

interface ZoneMatch {
  zone: {
    zone_id: string;
    zone_name: string;
    color_primary: string;
    color_secondary: string;
    motion_pattern?: string;
  };
  isDemo: boolean;
  confidence: number;
}

function findMatchingZone(colorSignature: number[]): ZoneMatch | null {
  const totalSamples = colorSignature.length / 3;
  let bestMatch: ZoneMatch | null = null;
  let bestScore = 0;

  // Check demo zones first
  for (const zone of DEMO_ZONES) {
    const score = calculateColorMatch(colorSignature, zone.color_primary, zone.color_secondary);
    if (score > bestScore && score > 0.15) {
      bestScore = score;
      bestMatch = { zone, isDemo: true, confidence: score };
    }
  }

  // Check database zones
  // Note: In production, you'd query supabase here
  // For now, demo zones are sufficient for testing

  return bestMatch;
}

function calculateColorMatch(
  colorSignature: number[],
  primaryHex: string,
  secondaryHex: string
): number {
  const primary = hexToRgb(primaryHex);
  const secondary = hexToRgb(secondaryHex);

  if (!primary || !secondary) return 0;

  let primaryMatches = 0;
  let secondaryMatches = 0;
  const totalSamples = colorSignature.length / 3;

  for (let i = 0; i < colorSignature.length; i += 3) {
    const r = colorSignature[i];
    const g = colorSignature[i + 1];
    const b = colorSignature[i + 2];

    const primaryDist = colorDistance(r, g, b, primary);
    const secondaryDist = colorDistance(r, g, b, secondary);

    // Tighter tolerance - distance < 50
    if (primaryDist < 50) primaryMatches++;
    if (secondaryDist < 50) secondaryMatches++;
  }

  const primaryRatio = primaryMatches / totalSamples;
  const secondaryRatio = secondaryMatches / totalSamples;

  // Return combined score - need both colors present
  return primaryRatio + secondaryRatio;
}

function colorDistance(r: number, g: number, b: number, target: { r: number; g: number; b: number }): number {
  return Math.sqrt(
    Math.pow(r - target.r, 2) +
    Math.pow(g - target.g, 2) +
    Math.pow(b - target.b, 2)
  );
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

    if (primaryRGB && colorDistance(r, g, b, primaryRGB) < 80) {
      primaryMatch++;
    }
    if (secondaryRGB && colorDistance(r, g, b, secondaryRGB) < 80) {
      secondaryMatch++;
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
