import { NextRequest, NextResponse } from 'next/server';
import { supabase, getDeviceToken } from '@/lib/supabase';

/**
 * Select N random unique days from a range
 */
function selectRandomDays(totalDays: number, count: number): number[] {
  const days: number[] = [];
  const available = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Shuffle and pick first N
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  return available.slice(0, count).sort((a, b) => a - b);
}

/**
 * Generate a random time within allowed windows (9-10 AM or 5-8 PM)
 */
function generateRandomTime(): { hour: number; minute: number } {
  const isEvening = Math.random() > 0.5;

  if (isEvening) {
    // 5-7 PM (17:00-19:59)
    const hour = 17 + Math.floor(Math.random() * 3);
    const minute = Math.floor(Math.random() * 60);
    return { hour, minute };
  } else {
    // 9-10 AM (9:00-10:59)
    const hour = 9 + Math.floor(Math.random() * 2);
    const minute = Math.floor(Math.random() * 60);
    return { hour, minute };
  }
}

/**
 * Schedule random check-ins for a device
 */
export async function scheduleCheckins(
  deviceToken: string,
  startDate: Date,
  numCheckins: number = 3
): Promise<{ success: boolean; scheduled: number }> {
  // Select random days from the 14-day verification period
  const checkInDays = selectRandomDays(14, numCheckins);

  const challenges = [];

  for (let i = 0; i < numCheckins; i++) {
    const day = checkInDays[i];
    const { hour, minute } = generateRandomTime();

    // Calculate the scheduled time
    const scheduledAt = new Date(startDate);
    scheduledAt.setDate(scheduledAt.getDate() + day - 1); // day 1 = start date
    scheduledAt.setHours(hour, minute, 0, 0);

    challenges.push({
      device_token: deviceToken,
      scheduled_at: scheduledAt.toISOString(),
      challenge_number: i + 1,
      status: 'pending',
    });
  }

  // Insert all challenges
  const { error } = await supabase
    .from('checkin_challenges')
    .upsert(challenges, {
      onConflict: 'device_token,challenge_number',
    });

  if (error) {
    console.error('Failed to schedule check-ins:', error);
    return { success: false, scheduled: 0 };
  }

  return { success: true, scheduled: challenges.length };
}

/**
 * API endpoint to schedule check-ins for a device
 * Called when user starts verification
 */
export async function POST(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    // Verify device exists and is in verifying status
    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (device.status !== 'verifying') {
      return NextResponse.json({
        error: 'Check-ins can only be scheduled for verifying devices',
      }, { status: 400 });
    }

    // Check if check-ins already scheduled
    const { data: existing } = await supabase
      .from('checkin_challenges')
      .select('id')
      .eq('device_token', deviceToken)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Check-ins already scheduled',
      });
    }

    // Schedule check-ins starting from verification start date
    const startDate = device.verification_start_date
      ? new Date(device.verification_start_date)
      : new Date();

    const result = await scheduleCheckins(deviceToken, startDate, 3);

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to schedule check-ins' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scheduled: result.scheduled,
    });
  } catch (error) {
    console.error('Schedule check-in error:', error);
    return NextResponse.json({ error: 'Failed to schedule check-ins' }, { status: 500 });
  }
}

/**
 * GET endpoint to retrieve scheduled check-ins for a device
 */
export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    const { data: challenges, error } = await supabase
      .from('checkin_challenges')
      .select('*')
      .eq('device_token', deviceToken)
      .order('challenge_number');

    if (error) {
      console.error('Failed to get check-ins:', error);
      return NextResponse.json({ error: 'Failed to get check-ins' }, { status: 500 });
    }

    const completed = challenges?.filter(c => c.status === 'completed').length || 0;
    const pending = challenges?.filter(c => c.status === 'pending' || c.status === 'sent').length || 0;

    return NextResponse.json({
      challenges: challenges || [],
      completed,
      pending,
      total: challenges?.length || 0,
    });
  } catch (error) {
    console.error('Get check-ins error:', error);
    return NextResponse.json({ error: 'Failed to get check-ins' }, { status: 500 });
  }
}
