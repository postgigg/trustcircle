import { NextRequest, NextResponse } from 'next/server';
import { supabase, getDeviceToken } from '@/lib/supabase';
import { securityMiddleware } from '@/middleware/security';

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
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
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    const { subscription } = await request.json() as { subscription: PushSubscriptionJSON };

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Verify device exists
    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Upsert the subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        device_token: deviceToken,
        zone_id: device.zone_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        is_active: true,
        failed_count: 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'device_token,endpoint',
      });

    if (error) {
      console.error('Failed to save push subscription:', error);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription saved',
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to process subscription' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  // Security check
  const security = await securityMiddleware(request);

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

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    // Deactivate the subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('device_token', deviceToken)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Failed to deactivate subscription:', error);
      return NextResponse.json({ error: 'Failed to deactivate subscription' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription deactivated',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to process unsubscription' }, { status: 500 });
  }
}
