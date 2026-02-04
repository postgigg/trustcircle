import { NextRequest, NextResponse } from 'next/server';
import { supabase, logMovement, getDeviceToken } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { securityMiddleware } from '@/middleware/security';

interface PresenceLogEntry {
  location_hash: string;
  checked_at: string;
}

interface MovementLogEntry {
  h3_index: string;
  movement_detected: boolean;
  checked_at: string;
}

interface CorrelationResult {
  score: number;
  flags: Record<string, boolean>;
}

/**
 * Correlate movement with recent presence data to detect spoofing
 */
async function correlateMovementWithPresence(
  deviceToken: string,
  movementDetected: boolean,
  lat?: number,
  lon?: number
): Promise<CorrelationResult> {
  const flags: Record<string, boolean> = {};
  let score = 1.0;

  if (!movementDetected) {
    // No movement detected, no need to correlate
    return { score, flags };
  }

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Get recent presence logs
  const { data: presenceLogs } = await supabase
    .from('presence_log')
    .select('location_hash, checked_at')
    .eq('device_token', deviceToken)
    .gte('checked_at', twoHoursAgo.toISOString())
    .order('checked_at', { ascending: false })
    .limit(10);

  // Get current H3 index for location if provided
  let currentH3Index: string | null = null;
  if (typeof lat === 'number' && typeof lon === 'number') {
    try {
      const h3 = await import('h3-js');
      currentH3Index = h3.latLngToCell(lat, lon, 7);
    } catch {
      // H3 import failed
    }
  }

  // Check 1: Impossible trajectory
  // If presence was confirmed far away very recently, flag as suspicious
  // (This is a simplified check - full implementation would calculate actual distance)
  if (presenceLogs && presenceLogs.length > 0 && currentH3Index) {
    const mostRecentPresence = presenceLogs[0] as PresenceLogEntry;
    const presenceH3 = mostRecentPresence.location_hash;

    // If H3 indexes are very different (different resolution-4 parent), flag it
    if (presenceH3 && presenceH3 !== currentH3Index) {
      try {
        const h3 = await import('h3-js');
        const presenceParent = h3.cellToParent(presenceH3, 4);
        const currentParent = h3.cellToParent(currentH3Index, 4);

        if (presenceParent !== currentParent) {
          // Check time difference
          const presenceTime = new Date(mostRecentPresence.checked_at).getTime();
          const timeDiffHours = (now.getTime() - presenceTime) / (1000 * 60 * 60);

          // If locations are very different but time is < 30 minutes, suspicious
          if (timeDiffHours < 0.5) {
            flags.impossible_trajectory = true;
            score -= 0.30;
          }
        }
      } catch {
        // H3 operations failed, skip this check
      }
    }
  }

  // Check 2: Stationary GPS + Movement
  // If same H3 location for 3+ movement checks but always showing movement
  if (currentH3Index) {
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const { data: recentMovement } = await supabase
      .from('movement_log')
      .select('h3_index, movement_detected')
      .eq('device_token', deviceToken)
      .eq('h3_index', currentH3Index)
      .eq('movement_detected', true)
      .gte('checked_at', threeDaysAgo.toISOString());

    if (recentMovement && recentMovement.length >= 3) {
      flags.stationary_with_movement = true;
      score -= 0.20;
    }
  }

  // Check 3: Nighttime movement anomaly
  // Movement at 2-5 AM is suspicious
  const hour = now.getHours();
  if (movementDetected && hour >= 2 && hour < 5) {
    flags.nighttime_movement = true;
    score -= 0.10;
  }

  // Ensure score doesn't go below 0
  score = Math.max(score, 0);

  return { score, flags };
}

/**
 * Store correlation score in database
 */
async function storeCorrelationScore(
  deviceToken: string,
  score: number,
  flags: Record<string, boolean>
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await supabase
    .from('correlation_scores')
    .upsert({
      device_token: deviceToken,
      score_date: today,
      trust_score: score,
      flags,
      calculated_at: new Date().toISOString(),
    }, {
      onConflict: 'device_token,score_date',
    });
}

export async function POST(request: NextRequest) {
  // Security check
  const security = await securityMiddleware(request);

  if (!security.allowed) {
    return NextResponse.json(
      { error: security.reason || 'Access denied' },
      { status: 403 }
    );
  }

  try {
    const { deviceToken, movementDetected, lat, lon, timestamp } = await request.json();

    if (!deviceToken || typeof movementDetected !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      return NextResponse.json({ error: 'Device is not active' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Log movement with location
    await logMovement(deviceToken, today, movementDetected, lat, lon);

    // Correlate movement with presence
    const correlation = await correlateMovementWithPresence(
      deviceToken,
      movementDetected,
      lat,
      lon
    );

    // Store correlation score
    await storeCorrelationScore(deviceToken, correlation.score, correlation.flags);

    // Check for suspicious patterns and take action
    if (correlation.score < 0.30) {
      // Auto-freeze the account
      await supabase
        .from('device_tokens')
        .update({ status: 'frozen' })
        .eq('device_token', deviceToken);

      return NextResponse.json({
        recorded: true,
        movementDaysConfirmed: device.movement_days_confirmed,
        frozen: true,
        reason: 'Suspicious activity detected',
      });
    }

    if (movementDetected && correlation.score >= 0.70) {
      // Only count movement if trust score is acceptable
      const newMovementDays = device.movement_days_confirmed + 1;

      await supabase
        .from('device_tokens')
        .update({
          movement_days_confirmed: newMovementDays,
          last_movement_at: new Date().toISOString(),
        })
        .eq('device_token', deviceToken);

      // Check activation criteria (updated to include check-ins and trust score)
      if (device.status === 'verifying') {
        const meetsNights = device.nights_confirmed >= 14;
        const meetsMovement = newMovementDays >= 10;
        const meetsCheckins = (device.checkins_completed || 0) >= 2; // Allow 2/3 with warning

        // Get average trust score
        const { data: avgScoreData } = await supabase.rpc('get_average_trust_score', {
          p_device_token: deviceToken,
          p_days: 14,
        });

        const avgTrustScore = avgScoreData || 1.0;
        const meetsTrust = avgTrustScore >= 0.70;

        if (meetsNights && meetsMovement && meetsCheckins && meetsTrust) {
          await supabase
            .from('device_tokens')
            .update({ status: 'active' })
            .eq('device_token', deviceToken);

          await supabase.rpc('increment_zone_residents', { zone: device.zone_id });
        }
      }

      return NextResponse.json({
        recorded: true,
        movementDaysConfirmed: newMovementDays,
        trustScore: correlation.score,
        flags: Object.keys(correlation.flags).filter(k => correlation.flags[k]),
      });
    }

    return NextResponse.json({
      recorded: true,
      movementDaysConfirmed: device.movement_days_confirmed,
      trustScore: correlation.score,
      flags: Object.keys(correlation.flags).filter(k => correlation.flags[k]),
    });
  } catch (error) {
    console.error('Movement check error:', error);
    return NextResponse.json({ error: 'Failed to record movement' }, { status: 500 });
  }
}
