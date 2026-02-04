import { NextRequest, NextResponse } from 'next/server';
import { supabase, getDeviceToken, updateZoneResidentCount } from '@/lib/supabase';
import { cancelSubscription } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const { deviceToken } = await request.json();

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 400 });
    }

    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    if (device.stripe_subscription_id) {
      try {
        await cancelSubscription(device.stripe_subscription_id);
      } catch (stripeError) {
        console.error('Failed to cancel Stripe subscription:', stripeError);
      }
    }

    const zoneId = device.zone_id;

    await supabase
      .from('presence_log')
      .delete()
      .eq('device_token', deviceToken);

    await supabase
      .from('movement_log')
      .delete()
      .eq('device_token', deviceToken);

    await supabase
      .from('vouches')
      .delete()
      .or(`voucher_device_token.eq.${deviceToken},vouchee_device_token.eq.${deviceToken}`);

    await supabase
      .from('subsidy_requests')
      .delete()
      .eq('device_token', deviceToken);

    await supabase
      .from('device_tokens')
      .delete()
      .eq('device_token', deviceToken);

    await updateZoneResidentCount(zoneId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Device deactivation error:', error);
    return NextResponse.json({ error: 'Failed to deactivate device' }, { status: 500 });
  }
}
