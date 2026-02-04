import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendNotificationToDevice } from '../../notifications/send/route';

/**
 * Cron job endpoint to send pending check-in notifications
 * Should be called every minute by Vercel cron or external service
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Find pending check-ins that should be sent
    // Look for challenges where:
    // - scheduled_at <= now (due)
    // - scheduled_at > now - 24 hours (not too old)
    // - status = 'pending'
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: pendingChallenges, error } = await supabase
      .from('checkin_challenges')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .gte('scheduled_at', cutoff.toISOString())
      .limit(100);

    if (error) {
      console.error('Failed to get pending challenges:', error);
      return NextResponse.json({ error: 'Failed to get pending challenges' }, { status: 500 });
    }

    if (!pendingChallenges || pendingChallenges.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No pending check-ins to send',
      });
    }

    let sent = 0;
    let failed = 0;

    for (const challenge of pendingChallenges) {
      // Send push notification
      const notificationSent = await sendNotificationToDevice(challenge.device_token, {
        title: 'Quick verify',
        body: 'Tap to confirm you\'re real (takes 3 seconds)',
        tag: `checkin-${challenge.id}`,
        data: {
          type: 'checkin',
          challengeId: challenge.id,
          url: '/checkin',
        },
        actions: [
          { action: 'verify', title: 'Verify Now' },
        ],
      });

      // Update challenge status
      const { error: updateError } = await supabase
        .from('checkin_challenges')
        .update({
          status: 'sent',
          sent_at: now.toISOString(),
        })
        .eq('id', challenge.id);

      if (updateError) {
        console.error('Failed to update challenge status:', updateError);
        failed++;
      } else if (notificationSent) {
        sent++;
      } else {
        // Notification failed but we still mark as sent
        // User can still complete via app
        sent++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: pendingChallenges.length,
    });
  } catch (error) {
    console.error('Send check-in error:', error);
    return NextResponse.json({ error: 'Failed to send check-ins' }, { status: 500 });
  }
}

/**
 * POST endpoint to manually expire old check-ins
 */
export async function POST(request: NextRequest) {
  try {
    // Verify server key
    const serverKey = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (serverKey && authHeader !== `Bearer ${serverKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'expire') {
      // Expire check-ins that were sent more than 30 minutes ago and not completed
      const cutoff = new Date(Date.now() - 30 * 60 * 1000);

      const { data, error } = await supabase
        .from('checkin_challenges')
        .update({ status: 'expired' })
        .eq('status', 'sent')
        .lt('sent_at', cutoff.toISOString())
        .select('id');

      if (error) {
        console.error('Failed to expire challenges:', error);
        return NextResponse.json({ error: 'Failed to expire challenges' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        expired: data?.length || 0,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Check-in action error:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
