import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/badge/secret
 *
 * Store a new secret hash for device verification.
 * Called every 30 seconds by the badge page to rotate the secret.
 *
 * Body: { secretHash: string }
 * Header: x-device-token
 *
 * Updates device_tokens.current_secret_hash
 */
export async function POST(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('x-device-token');

    if (!deviceToken) {
      return NextResponse.json(
        { error: 'Missing device token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { secretHash } = body;

    if (!secretHash || typeof secretHash !== 'string') {
      return NextResponse.json(
        { error: 'Invalid secret hash' },
        { status: 400 }
      );
    }

    // Validate secret hash format (should be 64 hex chars for sha256)
    if (!/^[a-f0-9]{64}$/i.test(secretHash)) {
      return NextResponse.json(
        { error: 'Invalid secret hash format' },
        { status: 400 }
      );
    }

    // Update the device's current secret hash
    const { error } = await supabase
      .from('device_tokens')
      .update({
        current_secret_hash: secretHash,
        secret_updated_at: new Date().toISOString(),
      })
      .eq('device_token', deviceToken);

    if (error) {
      console.error('Failed to update secret hash:', error);
      return NextResponse.json(
        { error: 'Failed to update secret' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Badge secret API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
