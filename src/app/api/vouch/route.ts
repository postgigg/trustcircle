import { NextRequest, NextResponse } from 'next/server';
import {
  getDeviceToken,
  getVouchCount,
  hasVouchedFor,
  recordVouch,
  supabase,
} from '@/lib/supabase';
import { activateSubsidy, requireActiveSubscription } from '@/lib/subscription-guard';

export async function POST(request: NextRequest) {
  try {
    const voucherToken = request.headers.get('x-device-token');
    const { voucheeToken, zoneId } = await request.json();

    if (!voucherToken) {
      return NextResponse.json({ error: 'Missing voucher token' }, { status: 401 });
    }

    // Verify voucher has active subscription
    const { authorized, status, error: paywallError } = await requireActiveSubscription(voucherToken);
    if (!authorized) {
      return NextResponse.json({
        error: paywallError,
        paywall: true,
        subscriptionStatus: status
      }, { status: 402 });
    }

    if (!voucheeToken || !zoneId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const voucher = await getDeviceToken(voucherToken);
    if (!voucher) {
      return NextResponse.json({ error: 'Voucher device not found' }, { status: 404 });
    }

    if (voucher.status !== 'active') {
      return NextResponse.json({ error: 'Only active residents can vouch' }, { status: 403 });
    }

    if (voucher.zone_id !== zoneId) {
      return NextResponse.json({ error: 'You can only vouch for residents in your zone' }, { status: 403 });
    }

    const voucherCreatedAt = new Date(voucher.created_at);
    const daysSinceCreation = (Date.now() - voucherCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      return NextResponse.json(
        { error: 'Your account must be at least 30 days old to vouch' },
        { status: 403 }
      );
    }

    const vouchCount = await getVouchCount(voucherToken);
    if (vouchCount >= 3) {
      return NextResponse.json(
        { error: 'You have used all 3 vouches for this year' },
        { status: 403 }
      );
    }

    const alreadyVouched = await hasVouchedFor(voucherToken, voucheeToken);
    if (alreadyVouched) {
      return NextResponse.json({ error: 'You have already vouched for this person' }, { status: 403 });
    }

    await recordVouch(voucherToken, voucheeToken, zoneId);

    const { data: subsidyRequest } = await supabase
      .from('subsidy_requests')
      .select('*')
      .eq('device_token', voucheeToken)
      .eq('status', 'pending')
      .single();

    if (subsidyRequest && subsidyRequest.vouch_count >= 10) {
      await supabase
        .from('subsidy_requests')
        .update({ status: 'activated' })
        .eq('request_id', subsidyRequest.request_id);

      // Activate subsidy with 1-year expiration
      await activateSubsidy(voucheeToken);

      await supabase
        .from('device_tokens')
        .update({ status: 'verifying', verification_start_date: new Date().toISOString().split('T')[0] })
        .eq('device_token', voucheeToken);
    }

    return NextResponse.json({
      success: true,
      vouchesRemaining: 3 - vouchCount - 1,
    });
  } catch (error) {
    console.error('Vouch error:', error);
    return NextResponse.json({ error: 'Failed to record vouch' }, { status: 500 });
  }
}
