import { NextRequest, NextResponse } from 'next/server';
import { incrementCorroboration } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscription-guard';

export async function POST(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    // Verify subscription
    if (deviceToken) {
      const { authorized, status, error: paywallError } = await requireActiveSubscription(deviceToken);
      if (!authorized) {
        return NextResponse.json({
          error: paywallError,
          paywall: true,
          subscriptionStatus: status
        }, { status: 402 });
      }
    }

    const { incidentId } = await request.json();

    if (!incidentId) {
      return NextResponse.json({ error: 'Missing incident ID' }, { status: 400 });
    }

    await incrementCorroboration(incidentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Corroboration error:', error);
    return NextResponse.json({ error: 'Failed to corroborate incident' }, { status: 500 });
  }
}
