import { NextRequest, NextResponse } from 'next/server';
import {
  getDeviceToken,
  getVouchCount,
  hasVouchedFor,
  recordVouch,
  supabase,
} from '@/lib/supabase';
import { activateSubsidy } from '@/lib/subscription-guard';

// This endpoint is called when a subsidy seeker scans a verified member's badge
// The seeker provides their own token in the header, and the badge seed in the body
export async function POST(request: NextRequest) {
  try {
    // The subsidy seeker's device token
    const seekerToken = request.headers.get('x-device-token');
    const { badgeSeed, zoneId } = await request.json();

    if (!seekerToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    if (!badgeSeed || !zoneId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the seeker exists and has a pending subsidy request
    const seeker = await getDeviceToken(seekerToken);
    if (!seeker) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Check if seeker has a pending subsidy request
    const { data: subsidyRequest } = await supabase
      .from('subsidy_requests')
      .select('*')
      .eq('device_token', seekerToken)
      .eq('status', 'pending')
      .single();

    if (!subsidyRequest) {
      return NextResponse.json({ error: 'No pending subsidy request found' }, { status: 404 });
    }

    // Validate the badge seed - find the active seed for this zone
    const now = new Date().toISOString();
    const { data: validSeed } = await supabase
      .from('badge_seeds')
      .select('*')
      .eq('zone_id', zoneId)
      .lte('valid_from', now)
      .gte('valid_until', now)
      .single();

    if (!validSeed || validSeed.seed !== badgeSeed) {
      return NextResponse.json({ error: 'Invalid or expired badge' }, { status: 400 });
    }

    // Find an active member in this zone who can vouch
    // We need to pick a voucher from the pool of active members
    const { data: activeMembers } = await supabase
      .from('device_tokens')
      .select('device_token, created_at')
      .eq('zone_id', zoneId)
      .eq('status', 'active')
      .neq('device_token', seekerToken);

    if (!activeMembers || activeMembers.length === 0) {
      return NextResponse.json({ error: 'No active members available to vouch' }, { status: 404 });
    }

    // Filter members who are eligible to vouch (30+ days old, < 3 vouches this year)
    let eligibleVoucher = null;
    for (const member of activeMembers) {
      const daysSinceCreation = (Date.now() - new Date(member.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 30) continue;

      const vouchCount = await getVouchCount(member.device_token);
      if (vouchCount >= 3) continue;

      const alreadyVouched = await hasVouchedFor(member.device_token, seekerToken);
      if (alreadyVouched) continue;

      eligibleVoucher = member.device_token;
      break;
    }

    if (!eligibleVoucher) {
      return NextResponse.json({
        error: 'Badge valid but no eligible vouchers available. Try scanning a different neighbor\'s badge.'
      }, { status: 400 });
    }

    // Record the vouch
    await recordVouch(eligibleVoucher, seekerToken, zoneId);

    // Check if seeker now has enough vouches
    const { data: updatedRequest } = await supabase
      .from('subsidy_requests')
      .select('vouch_count')
      .eq('device_token', seekerToken)
      .eq('status', 'pending')
      .single();

    const newVouchCount = updatedRequest?.vouch_count || 0;

    if (newVouchCount >= 10) {
      await supabase
        .from('subsidy_requests')
        .update({ status: 'activated' })
        .eq('request_id', subsidyRequest.request_id);

      // Activate subsidy with 1-year expiration
      await activateSubsidy(seekerToken);

      await supabase
        .from('device_tokens')
        .update({ status: 'verifying', verification_start_date: new Date().toISOString().split('T')[0] })
        .eq('device_token', seekerToken);
    }

    return NextResponse.json({
      success: true,
      vouchCount: newVouchCount,
      activated: newVouchCount >= 10,
    });
  } catch (error) {
    console.error('Vouch scan error:', error);
    return NextResponse.json({ error: 'Failed to process badge scan' }, { status: 500 });
  }
}
