import { NextRequest, NextResponse } from 'next/server';
import { createIncidentReport, supabase, addToBlacklist, getZoneById } from '@/lib/supabase';
import { encryptData } from '@/lib/crypto';
import { requireActiveSubscription } from '@/lib/subscription-guard';
import { sendNotificationsToZone } from '../../notifications/send/route';
import { securityMiddleware } from '@/middleware/security';

const ENCRYPTION_KEY = process.env.INCIDENT_ENCRYPTION_KEY || 'default-key-change-in-production';

export async function POST(request: NextRequest) {
  // Security check
  const security = await securityMiddleware(request, {
    maxRequests: 10, // Lower limit for incident reports
    windowSeconds: 60,
  });

  if (!security.allowed) {
    return NextResponse.json(
      { error: security.reason || 'Access denied' },
      { status: 403 }
    );
  }

  try {
    const deviceToken = request.headers.get('x-device-token');

    // Verify subscription if device token is provided
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

    const {
      zoneId,
      photo,
      vehicleColor,
      vehicleType,
      licensePlate,
      locationNote,
      notes,
      failedDeviceToken,
      failedDeviceFingerprint,
    } = await request.json();

    if (!zoneId) {
      return NextResponse.json({ error: 'Missing zone ID' }, { status: 400 });
    }

    const zone = await getZoneById(zoneId);
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const reporterIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `report:${reporterIp}`;

    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('identifier', rateLimitKey)
      .eq('action_type', 'incident_report')
      .single();

    if (rateLimit) {
      const windowStart = new Date(rateLimit.window_start);
      const hoursSinceStart = (Date.now() - windowStart.getTime()) / (1000 * 60 * 60);

      if (hoursSinceStart < 24 && rateLimit.action_count >= 3) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Maximum 3 reports per 24 hours.' },
          { status: 429 }
        );
      }

      if (hoursSinceStart >= 24) {
        await supabase
          .from('rate_limits')
          .update({ action_count: 1, window_start: new Date().toISOString() })
          .eq('identifier', rateLimitKey);
      } else {
        await supabase
          .from('rate_limits')
          .update({ action_count: rateLimit.action_count + 1 })
          .eq('identifier', rateLimitKey);
      }
    } else {
      await supabase.from('rate_limits').insert({
        identifier: rateLimitKey,
        action_type: 'incident_report',
        action_count: 1,
        window_start: new Date().toISOString(),
      });
    }

    const incident = await createIncidentReport({
      zone_id: zoneId,
      photo_encrypted: photo ? encryptData(photo, ENCRYPTION_KEY) : undefined,
      vehicle_color: vehicleColor,
      vehicle_type: vehicleType,
      license_plate_encrypted: licensePlate ? encryptData(licensePlate, ENCRYPTION_KEY) : undefined,
      location_note: locationNote,
      notes_encrypted: notes ? encryptData(notes, ENCRYPTION_KEY) : undefined,
    });

    if (failedDeviceToken && failedDeviceFingerprint) {
      await supabase
        .from('device_tokens')
        .update({ status: 'revoked', deactivated_at: new Date().toISOString() })
        .eq('device_token', failedDeviceToken);

      await addToBlacklist(failedDeviceFingerprint, 'revoked_by_scan', zoneId);
    }

    const { count } = await supabase
      .from('device_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', zoneId)
      .eq('status', 'active');

    // Send push notifications to zone residents
    let notificationsSent = 0;
    try {
      const vehicleDescription = [vehicleColor, vehicleType].filter(Boolean).join(' ');
      const alertBody = vehicleDescription
        ? `${vehicleDescription} reported in your area`
        : 'Suspicious activity reported in your area';

      const result = await sendNotificationsToZone(
        zoneId,
        {
          title: 'Alert: Suspicious Activity',
          body: alertBody,
          tag: `incident-${incident.id}`,
          data: {
            type: 'incident',
            incidentId: incident.id,
            url: '/alerts',
          },
        },
        deviceToken || undefined // Exclude the reporter from notification
      );

      notificationsSent = result.sent;
    } catch (notifyError) {
      console.error('Failed to send incident notifications:', notifyError);
      // Don't fail the request if notifications fail
    }

    return NextResponse.json({
      success: true,
      incidentId: incident.id,
      alertedResidents: count || 0,
      notificationsSent,
    });
  } catch (error) {
    console.error('Incident report error:', error);
    return NextResponse.json({ error: 'Failed to create incident report' }, { status: 500 });
  }
}
