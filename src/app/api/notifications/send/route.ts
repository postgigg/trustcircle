import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '@/lib/supabase';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@trustcircle.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  device_token: string;
}

/**
 * Send push notifications to all active subscribers in a zone
 */
export async function sendNotificationsToZone(
  zoneId: string,
  payload: NotificationPayload,
  excludeDeviceToken?: string
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('VAPID keys not configured');
    return { sent: 0, failed: 0 };
  }

  // Get all active subscriptions for the zone
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, device_token')
    .eq('zone_id', zoneId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to get subscriptions:', error);
    return { sent: 0, failed: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`No active subscriptions for zone ${zoneId}`);
    return { sent: 0, failed: 0 };
  }

  // Filter out the reporter's device if specified
  const targetSubscriptions = excludeDeviceToken
    ? subscriptions.filter((s: PushSubscriptionRecord) => s.device_token !== excludeDeviceToken)
    : subscriptions;

  let sent = 0;
  let failed = 0;

  // Send notifications in batches of 100
  const batchSize = 100;
  for (let i = 0; i < targetSubscriptions.length; i += batchSize) {
    const batch = targetSubscriptions.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (sub: PushSubscriptionRecord) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );
          return { success: true, endpoint: sub.endpoint };
        } catch (err) {
          const pushError = err as { statusCode?: number };

          // Handle expired/invalid subscriptions
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            // Deactivate the subscription
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('endpoint', sub.endpoint);
          } else {
            // Increment failed count
            await supabase.rpc('increment_subscription_failed', { p_endpoint: sub.endpoint });
          }

          throw err;
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
      }
    }
  }

  // Log the notification
  await supabase.rpc('log_notification', {
    p_zone_id: zoneId,
    p_type: payload.tag || 'general',
    p_payload: payload,
    p_recipients: sent,
    p_failed: failed,
  });

  return { sent, failed };
}

/**
 * Send a push notification to a specific device
 */
export async function sendNotificationToDevice(
  deviceToken: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('VAPID keys not configured');
    return false;
  }

  // Get active subscriptions for the device
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('device_token', deviceToken)
    .eq('is_active', true);

  if (error || !subscriptions || subscriptions.length === 0) {
    console.log(`No active subscriptions for device ${deviceToken}`);
    return false;
  }

  let anySuccess = false;

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
      anySuccess = true;
    } catch (err) {
      const pushError = err as { statusCode?: number };

      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('endpoint', sub.endpoint);
      }

      console.error('Failed to send notification:', err);
    }
  }

  return anySuccess;
}

// API endpoint for sending test notifications or triggering zone alerts
export async function POST(request: NextRequest) {
  try {
    // This endpoint should be protected - check for admin/server key
    const authHeader = request.headers.get('authorization');
    const serverKey = process.env.NOTIFICATION_SERVER_KEY;

    if (serverKey && authHeader !== `Bearer ${serverKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { zoneId, deviceToken, payload, type } = await request.json();

    if (!payload || !payload.title) {
      return NextResponse.json({ error: 'Missing notification payload' }, { status: 400 });
    }

    if (type === 'zone' && zoneId) {
      const result = await sendNotificationsToZone(zoneId, payload);
      return NextResponse.json({
        success: true,
        sent: result.sent,
        failed: result.failed,
      });
    }

    if (type === 'device' && deviceToken) {
      const success = await sendNotificationToDevice(deviceToken, payload);
      return NextResponse.json({
        success,
        message: success ? 'Notification sent' : 'Failed to send notification',
      });
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
