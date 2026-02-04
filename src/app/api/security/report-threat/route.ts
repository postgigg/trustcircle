import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, logThreat, blacklistIP } from '@/lib/security';

/**
 * Receive threat reports from client
 * Client only sends: threatType + fingerprintHash (NO device details)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    const { threatType, fingerprintHash } = await request.json();

    if (!threatType || typeof threatType !== 'string') {
      return NextResponse.json({ error: 'Missing threat type' }, { status: 400 });
    }

    // Validate threat type
    const validThreatTypes = [
      'emulator',
      'headless',
      'automation',
      'inconsistency',
      'bot_pattern',
      'debugger',
      'tampering',
    ];

    if (!validThreatTypes.includes(threatType)) {
      return NextResponse.json({ error: 'Invalid threat type' }, { status: 400 });
    }

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (threatType === 'automation' || threatType === 'headless') {
      severity = 'high';
    } else if (threatType === 'emulator' || threatType === 'bot_pattern') {
      severity = 'medium';
    }

    // Log the threat
    await logThreat({
      ip,
      fingerprintHash: fingerprintHash || undefined,
      threatType: `client_${threatType}`,
      severity,
      endpoint: '/api/security/report-threat',
      actionTaken: 'logged',
    });

    // For high-severity threats, take immediate action
    if (severity === 'high') {
      // Blacklist the fingerprint if provided
      if (fingerprintHash) {
        const { supabase } = await import('@/lib/supabase');

        // Check if already blacklisted
        const { data: existing } = await supabase
          .from('blacklist')
          .select('id')
          .eq('device_fingerprint_hash', fingerprintHash)
          .single();

        if (!existing) {
          await supabase.from('blacklist').insert({
            device_fingerprint_hash: fingerprintHash,
            reason: `client_reported_${threatType}`,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      recorded: true,
    });
  } catch (error) {
    console.error('Threat report error:', error);
    return NextResponse.json({ error: 'Failed to record threat' }, { status: 500 });
  }
}
