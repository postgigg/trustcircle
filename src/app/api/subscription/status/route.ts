import { NextRequest, NextResponse } from 'next/server';
import { verifySubscription } from '@/lib/subscription-guard';

export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const subscriptionStatus = await verifySubscription(deviceToken);

    return NextResponse.json(subscriptionStatus);
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ error: 'Failed to get subscription status' }, { status: 500 });
  }
}
