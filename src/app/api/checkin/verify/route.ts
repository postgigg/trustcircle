import { NextRequest, NextResponse } from 'next/server';
import { supabase, getDeviceToken } from '@/lib/supabase';
import { securityMiddleware } from '@/middleware/security';

interface TouchPoint {
  x: number;
  y: number;
  t: number;
}

interface TouchData {
  points: TouchPoint[];
  duration: number;
}

/**
 * Calculate straightness of touch path
 * Perfect line = 1.0, more curves = lower value
 */
function calculateStraightness(points: TouchPoint[]): number {
  if (points.length < 3) return 1.0;

  const start = points[0];
  const end = points[points.length - 1];

  // Calculate expected line
  const lineLength = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
  );

  if (lineLength === 0) return 1.0;

  // Calculate total deviation from the line
  let totalDeviation = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];

    // Distance from point to line between start and end
    const numerator = Math.abs(
      (end.y - start.y) * point.x -
      (end.x - start.x) * point.y +
      end.x * start.y -
      end.y * start.x
    );
    const denominator = lineLength;
    const distance = numerator / denominator;

    totalDeviation += distance;
  }

  // Average deviation as percentage of line length
  const avgDeviation = totalDeviation / (points.length - 2);
  const deviationRatio = avgDeviation / lineLength;

  // Convert to straightness score (1 = perfectly straight)
  return Math.max(0, 1 - deviationRatio * 2);
}

/**
 * Calculate speed variance
 * Humans have variable speed, bots are constant
 */
function calculateSpeedVariance(points: TouchPoint[]): number {
  if (points.length < 3) return 0;

  const speeds: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dt = points[i].t - points[i - 1].t;

    if (dt > 0) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = distance / dt;
      speeds.push(speed);
    }
  }

  if (speeds.length < 2) return 0;

  // Calculate variance
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / speeds.length;

  // Normalize variance (higher = more variance = more human-like)
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  return Math.min(coefficientOfVariation, 1);
}

/**
 * Calculate jitter (micro-movements)
 * Humans have natural wobble, bots don't
 */
function calculateJitter(points: TouchPoint[]): number {
  if (points.length < 5) return 0;

  let totalJitter = 0;

  // Look at small-scale direction changes
  for (let i = 2; i < points.length; i++) {
    const prev = points[i - 2];
    const mid = points[i - 1];
    const curr = points[i];

    // Calculate angle change
    const angle1 = Math.atan2(mid.y - prev.y, mid.x - prev.x);
    const angle2 = Math.atan2(curr.y - mid.y, curr.x - mid.x);
    const angleDiff = Math.abs(angle2 - angle1);

    // Small angle changes indicate jitter
    if (angleDiff > 0.01 && angleDiff < 0.5) {
      totalJitter += angleDiff;
    }
  }

  // Normalize jitter score (0-1)
  const avgJitter = totalJitter / (points.length - 2);
  return Math.min(avgJitter * 10, 1);
}

/**
 * Analyze touch pattern to determine if human or bot
 */
function analyzeTouchPattern(touchData: TouchData): {
  isHuman: boolean;
  confidence: number;
  metrics: {
    straightness: number;
    speedVariance: number;
    jitter: number;
    duration: number;
  };
  flags: string[];
} {
  const { points, duration } = touchData;
  const flags: string[] = [];

  // Minimum requirements
  if (points.length < 5) {
    return {
      isHuman: false,
      confidence: 0,
      metrics: { straightness: 0, speedVariance: 0, jitter: 0, duration },
      flags: ['insufficient_data'],
    };
  }

  // Calculate metrics
  const straightness = calculateStraightness(points);
  const speedVariance = calculateSpeedVariance(points);
  const jitter = calculateJitter(points);

  // Duration check (bots are too fast or too slow)
  if (duration < 200) {
    flags.push('too_fast');
  }
  if (duration > 10000) {
    flags.push('too_slow');
  }

  // Straightness check (bots are too perfect)
  if (straightness > 0.98) {
    flags.push('too_straight');
  }
  if (straightness < 0.70) {
    flags.push('too_curved');
  }

  // Speed variance check (bots are too consistent)
  if (speedVariance < 0.05) {
    flags.push('constant_speed');
  }

  // Jitter check (bots have no natural wobble)
  if (jitter < 0.05) {
    flags.push('no_jitter');
  }

  // Determine if human
  // Human ranges from plan:
  // - Straightness: 0.70 - 0.95 (bots 0.98-1.00)
  // - Speed Variance: 0.15 - 0.60 (bots < 0.05)
  // - Jitter: moderate (bots < 1px / very low)
  // - Duration: 500-3000ms (bots < 200ms or > 10000ms)

  const isHumanStraightness = straightness >= 0.70 && straightness <= 0.98;
  const isHumanSpeed = speedVariance >= 0.10;
  const isHumanJitter = jitter >= 0.03;
  const isHumanDuration = duration >= 200 && duration <= 10000;

  // Need at least 3 of 4 human indicators
  const humanIndicators = [
    isHumanStraightness,
    isHumanSpeed,
    isHumanJitter,
    isHumanDuration,
  ].filter(Boolean).length;

  const isHuman = humanIndicators >= 3 && flags.length <= 1;

  // Calculate confidence
  let confidence = 0.5;
  if (isHumanStraightness) confidence += 0.15;
  if (isHumanSpeed) confidence += 0.15;
  if (isHumanJitter) confidence += 0.10;
  if (isHumanDuration) confidence += 0.10;
  confidence = Math.min(confidence, 1);

  return {
    isHuman,
    confidence,
    metrics: {
      straightness,
      speedVariance,
      jitter,
      duration,
    },
    flags,
  };
}

export async function POST(request: NextRequest) {
  // Security check
  const security = await securityMiddleware(request, {
    maxRequests: 20,
    windowSeconds: 60,
  });

  if (!security.allowed) {
    return NextResponse.json(
      { error: security.reason || 'Access denied' },
      { status: 403 }
    );
  }

  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    const { challengeId, touchData } = await request.json() as {
      challengeId?: string;
      touchData: TouchData;
    };

    if (!touchData || !touchData.points || touchData.points.length === 0) {
      return NextResponse.json({ error: 'Missing touch data' }, { status: 400 });
    }

    // Verify device exists
    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Find the challenge to verify
    let challenge;

    if (challengeId) {
      // Specific challenge
      const { data, error } = await supabase
        .from('checkin_challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('device_token', deviceToken)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
      }

      challenge = data;
    } else {
      // Find the most recent sent challenge
      const { data, error } = await supabase
        .from('checkin_challenges')
        .select('*')
        .eq('device_token', deviceToken)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'No pending challenge found' }, { status: 404 });
      }

      challenge = data;
    }

    // Check if challenge is still valid (within 30 min window)
    if (challenge.sent_at) {
      const sentTime = new Date(challenge.sent_at).getTime();
      const now = Date.now();
      const windowMs = 30 * 60 * 1000; // 30 minutes

      if (now - sentTime > windowMs) {
        // Mark as expired
        await supabase
          .from('checkin_challenges')
          .update({ status: 'expired' })
          .eq('id', challenge.id);

        return NextResponse.json({
          error: 'Challenge expired',
          expired: true,
        }, { status: 400 });
      }
    }

    // Analyze the touch pattern
    const analysis = analyzeTouchPattern(touchData);

    // Update the challenge
    const newStatus = analysis.isHuman ? 'completed' : 'failed';

    const { error: updateError } = await supabase
      .from('checkin_challenges')
      .update({
        status: newStatus,
        completed_at: new Date().toISOString(),
        touch_data: {
          points: touchData.points.slice(0, 100), // Limit stored points
          straightness: analysis.metrics.straightness,
          speedVariance: analysis.metrics.speedVariance,
          jitter: analysis.metrics.jitter,
          duration: touchData.duration,
        },
        is_human: analysis.isHuman,
      })
      .eq('id', challenge.id);

    if (updateError) {
      console.error('Failed to update challenge:', updateError);
      return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 });
    }

    // If human, increment check-ins completed
    if (analysis.isHuman) {
      await supabase.rpc('increment_checkins', { p_device_token: deviceToken });

      // Also add a small trust score bonus
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('correlation_scores')
        .upsert({
          device_token: deviceToken,
          score_date: today,
          trust_score: 1.05, // Small bonus for passing check-in
          flags: { checkin_passed: true },
        }, {
          onConflict: 'device_token,score_date',
        });
    }

    return NextResponse.json({
      success: true,
      passed: analysis.isHuman,
      confidence: analysis.confidence,
      flags: analysis.flags,
      checkinsCompleted: device.checkins_completed + (analysis.isHuman ? 1 : 0),
      checkinsRequired: device.checkins_required || 3,
    });
  } catch (error) {
    console.error('Verify check-in error:', error);
    return NextResponse.json({ error: 'Failed to verify check-in' }, { status: 500 });
  }
}
