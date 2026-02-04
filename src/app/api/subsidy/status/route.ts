import { NextRequest, NextResponse } from 'next/server';
import { getSubsidyRequest, supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const subsidyRequest = await getSubsidyRequest(deviceToken);

    if (!subsidyRequest) {
      return NextResponse.json({ error: 'No subsidy request found' }, { status: 404 });
    }

    if (subsidyRequest.status === 'activated') {
      return NextResponse.json({
        status: 'activated',
        vouchCount: subsidyRequest.vouch_count,
      });
    }

    if (new Date(subsidyRequest.expires_at) < new Date()) {
      await supabase
        .from('subsidy_requests')
        .update({ status: 'expired' })
        .eq('request_id', subsidyRequest.request_id);

      return NextResponse.json({
        status: 'expired',
        vouchCount: subsidyRequest.vouch_count,
      });
    }

    return NextResponse.json({
      status: subsidyRequest.status,
      vouchCount: subsidyRequest.vouch_count,
      qrData: subsidyRequest.qr_code_data,
      expiresAt: subsidyRequest.expires_at,
    });
  } catch (error) {
    console.error('Subsidy status error:', error);
    return NextResponse.json({ error: 'Failed to get subsidy status' }, { status: 500 });
  }
}
