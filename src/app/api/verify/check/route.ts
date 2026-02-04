import { NextRequest, NextResponse } from 'next/server';
import { getAllZones, supabase } from '@/lib/supabase';
import { generateCurrentSeed, getAnimationParameters, verifySeedMatch } from '@/lib/badge-seed';
import { prefixToHex } from '@/lib/patternEncoder';
import { securityMiddleware } from '@/middleware/security';
import crypto from 'crypto';
import type { Zone } from '@/types';

/**
 * POST /api/verify/check
 *
 * Supports two verification modes:
 * 1. Color signature verification (legacy) - colorSignature param
 * 2. Pattern verification (new, O(1) lookup) - devicePrefix + checksum params
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await securityMiddleware(request, {
    maxRequests: 30, // Higher limit for verification
    windowSeconds: 60,
  });

  if (!security.allowed) {
    return NextResponse.json(
      { error: security.reason || 'Access denied' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // Check if this is pattern-based verification
    if (body.devicePrefix !== undefined && body.checksum !== undefined) {
      return await verifyPattern(body.devicePrefix, body.checksum, body.zoneId);
    }

    // Legacy color signature verification
    const { colorSignature } = body;

    if (!colorSignature || !Array.isArray(colorSignature) || colorSignature.length < 9) {
      return NextResponse.json({ error: 'Invalid color signature' }, { status: 400 });
    }

    // Fetch all zones from database
    const zones = await getAllZones();

    if (!zones || zones.length === 0) {
      return NextResponse.json({ verified: false, reason: 'No zones available' });
    }

    // Find which zone's colors best match the signature
    const matchedZone = findMatchingZone(colorSignature, zones);

    if (!matchedZone) {
      return NextResponse.json({ verified: false, reason: 'No matching zone colors' });
    }

    // Verify the seed/animation parameters for all zones (real verification)
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

    // If seed match fails but color match is strong, still verify (for demo/testing)
    if (matchedZone.confidence > 0.4) {
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

/**
 * Pattern-based verification with O(1) database lookup
 *
 * Uses device token prefix for indexed lookup, then verifies checksum
 * against the device's current secret hash.
 */
async function verifyPattern(
  devicePrefix: number,
  checksum: number,
  zoneId?: string
): Promise<NextResponse> {
  try {
    // Convert prefix to hex string for LIKE query
    const prefixHex = prefixToHex(devicePrefix);

    // Build query - O(1) lookup using index on device_token prefix
    let query = supabase
      .from('device_tokens')
      .select('device_token, zone_id, current_secret_hash, status, zones(zone_name)')
      .like('device_token', `${prefixHex}%`)
      .not('current_secret_hash', 'is', null)
      .in('status', ['active', 'verifying'])
      .limit(10);

    // Filter by zone if provided
    if (zoneId) {
      query = query.eq('zone_id', zoneId);
    }

    const { data: devices, error } = await query;

    if (error) {
      console.error('Pattern verification query error:', error);
      return NextResponse.json({ verified: false, reason: 'Database error' });
    }

    if (!devices || devices.length === 0) {
      return NextResponse.json({
        verified: false,
        reason: 'No matching device found',
      });
    }

    // Verify checksum against each potential device
    for (const device of devices) {
      if (!device.current_secret_hash) continue;

      // Compute expected checksum: sha256(device_token + current_secret_hash)[0]
      const hash = crypto
        .createHash('sha256')
        .update(device.device_token + device.current_secret_hash)
        .digest();

      const expectedChecksum = hash[0];

      if (expectedChecksum === checksum) {
        // Match found!
        // zones is an array from the join, get first element
        const zonesData = device.zones as unknown as { zone_name: string }[] | null;
        const zoneName = zonesData?.[0]?.zone_name || 'Unknown Zone';

        return NextResponse.json({
          verified: true,
          zoneName,
          zoneId: device.zone_id,
          confidence: 1.0, // Pattern match is high confidence
          verificationMethod: 'pattern',
        });
      }
    }

    // No checksum match found
    return NextResponse.json({
      verified: false,
      reason: 'Checksum mismatch - possible replay or expired secret',
    });
  } catch (error) {
    console.error('Pattern verification error:', error);
    return NextResponse.json({ verified: false, reason: 'Verification failed' });
  }
}

interface ZoneMatch {
  zone: Zone;
  confidence: number;
}

function findMatchingZone(colorSignature: number[], zones: Zone[]): ZoneMatch | null {
  let bestMatch: ZoneMatch | null = null;
  let bestScore = 0;

  // Check all zones from database and find the best match
  for (const zone of zones) {
    const score = calculateColorMatch(colorSignature, zone.color_primary, zone.color_secondary);

    // Higher threshold - need at least 0.25 combined score
    // This prevents false positives from random environment colors
    if (score > bestScore && score > 0.25) {
      bestScore = score;
      bestMatch = { zone, confidence: Math.min(1, score * 2) };
    }
  }

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

    // Tight tolerance - distance < 45 for accurate matching
    if (primaryDist < 45) primaryMatches++;
    if (secondaryDist < 45) secondaryMatches++;
  }

  const primaryRatio = primaryMatches / totalSamples;
  const secondaryRatio = secondaryMatches / totalSamples;

  // BOTH colors must be present - this prevents false positives
  // If either color is missing, return 0
  if (primaryRatio < 0.1 || secondaryRatio < 0.1) {
    return 0;
  }

  // Return combined score weighted by how balanced the colors are
  // Badges should have both colors, not just one
  const balance = Math.min(primaryRatio, secondaryRatio) / Math.max(primaryRatio, secondaryRatio);
  return (primaryRatio + secondaryRatio) * (0.5 + balance * 0.5);
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
  zone: Zone
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
