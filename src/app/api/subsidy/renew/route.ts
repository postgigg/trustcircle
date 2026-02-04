import { NextRequest, NextResponse } from 'next/server';
import { getDeviceToken, supabase, createSubsidyRequest } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const device = await getDeviceToken(deviceToken);
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Only subsidized users can use renewal
    if (device.subscription_type !== 'subsidized') {
      return NextResponse.json(
        { error: 'Only sponsored users can use the renewal process' },
        { status: 403 }
      );
    }

    // Check if there's already a pending renewal request
    const { data: existingRequest } = await supabase
      .from('subsidy_requests')
      .select('*')
      .eq('device_token', deviceToken)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return NextResponse.json({
        success: true,
        requestId: existingRequest.request_id,
        vouchCount: existingRequest.vouch_count,
        qrCodeData: existingRequest.qr_code_data,
        expiresAt: existingRequest.expires_at,
        isRenewal: true,
      });
    }

    // Create a new renewal subsidy request
    const qrCodeData = `renewal:${deviceToken}:${uuidv4()}`;
    const subsidyRequest = await createSubsidyRequest(deviceToken, device.zone_id, qrCodeData);

    // Mark the request as a renewal
    await supabase
      .from('subsidy_requests')
      .update({ metadata: { is_renewal: true } })
      .eq('request_id', subsidyRequest.request_id);

    return NextResponse.json({
      success: true,
      requestId: subsidyRequest.request_id,
      vouchCount: 0,
      qrCodeData: subsidyRequest.qr_code_data,
      expiresAt: subsidyRequest.expires_at,
      isRenewal: true,
    });
  } catch (error) {
    console.error('Subsidy renewal error:', error);
    return NextResponse.json({ error: 'Failed to start renewal process' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    // Get the current renewal request status
    const { data: subsidyRequest } = await supabase
      .from('subsidy_requests')
      .select('*')
      .eq('device_token', deviceToken)
      .eq('status', 'pending')
      .single();

    if (!subsidyRequest) {
      return NextResponse.json({ hasActiveRenewal: false });
    }

    return NextResponse.json({
      hasActiveRenewal: true,
      requestId: subsidyRequest.request_id,
      vouchCount: subsidyRequest.vouch_count,
      vouchesNeeded: 10 - subsidyRequest.vouch_count,
      qrCodeData: subsidyRequest.qr_code_data,
      expiresAt: subsidyRequest.expires_at,
    });
  } catch (error) {
    console.error('Subsidy renewal status error:', error);
    return NextResponse.json({ error: 'Failed to get renewal status' }, { status: 500 });
  }
}
