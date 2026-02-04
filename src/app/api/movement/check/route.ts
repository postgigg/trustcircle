import { NextRequest, NextResponse } from 'next/server';
import { supabase, logMovement, getDeviceToken } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscription-guard';

export async function POST(request: NextRequest) {
  try {
    const { deviceToken, movementDetected } = await request.json();

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
    await logMovement(deviceToken, today, movementDetected);

    if (movementDetected) {
      const newMovementDays = device.movement_days_confirmed + 1;

      await supabase
        .from('device_tokens')
        .update({
          movement_days_confirmed: newMovementDays,
          last_movement_at: new Date().toISOString(),
        })
        .eq('device_token', deviceToken);

      if (device.status === 'verifying' && device.nights_confirmed >= 14 && newMovementDays >= 10) {
        await supabase
          .from('device_tokens')
          .update({ status: 'active' })
          .eq('device_token', deviceToken);

        await supabase.rpc('increment_zone_residents', { zone: device.zone_id });
      }

      return NextResponse.json({
        recorded: true,
        movementDaysConfirmed: newMovementDays,
      });
    }

    return NextResponse.json({
      recorded: true,
      movementDaysConfirmed: device.movement_days_confirmed,
    });
  } catch (error) {
    console.error('Movement check error:', error);
    return NextResponse.json({ error: 'Failed to record movement' }, { status: 500 });
  }
}
