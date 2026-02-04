import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, getCheckoutSession } from '@/lib/stripe';
import { supabase, createDeviceToken, contributeToSubsidyPool, updateZoneResidentCount } from '@/lib/supabase';
import { sha256 } from '@/lib/crypto';
import { v4 as uuidv4 } from 'uuid';
import { setGracePeriod, clearGracePeriod, expireSubscription } from '@/lib/subscription-guard';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const zoneId = session.metadata?.zone_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!zoneId) {
          console.error('No zone_id in session metadata');
          break;
        }

        const fullSession = await getCheckoutSession(session.id);
        const successUrl = fullSession.success_url || '';
        const urlParams = new URL(successUrl).searchParams;
        const fingerprint = urlParams.get('fingerprint');

        if (!fingerprint) {
          console.error('No fingerprint in success URL');
          break;
        }

        const deviceToken = sha256(`${fingerprint}:${Date.now()}:${uuidv4()}`);

        await createDeviceToken({
          device_token: deviceToken,
          device_fingerprint_hash: fingerprint,
          zone_id: zoneId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_type: 'paid',
        });

        await supabase.from('temp_device_mapping').upsert({
          session_id: session.id,
          device_token: deviceToken,
          zone_id: zoneId,
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as { subscription?: string | null; customer: string | null };
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        const { data: device } = await supabase
          .from('device_tokens')
          .select('*')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (device && device.subscription_type === 'paid') {
          await contributeToSubsidyPool(device.zone_id, 0.33);
        }

        // Clear grace period and set paywall status to active
        await clearGracePeriod(customerId);

        if (device && device.status === 'inactive') {
          await supabase
            .from('device_tokens')
            .update({ status: 'active' })
            .eq('stripe_customer_id', customerId);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { customer: string | null };
        const customerId = invoice.customer as string;

        // Set 7-day grace period instead of immediately deactivating
        await setGracePeriod(customerId);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const { data: device } = await supabase
          .from('device_tokens')
          .select('zone_id')
          .eq('stripe_customer_id', customerId)
          .single();

        // Set paywall status to expired
        await expireSubscription(customerId);

        await supabase
          .from('device_tokens')
          .update({
            status: 'inactive',
            deactivated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        if (device) {
          await updateZoneResidentCount(device.zone_id);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
