import { NextRequest, NextResponse } from 'next/server';
import { getActiveIncidents } from '@/lib/supabase';
import { decryptData } from '@/lib/crypto';
import { requireActiveSubscription } from '@/lib/subscription-guard';

const ENCRYPTION_KEY = process.env.INCIDENT_ENCRYPTION_KEY || 'default-key-change-in-production';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
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

    const { zoneId } = await params;

    const incidents = await getActiveIncidents(zoneId);

    const alerts = incidents.map((incident) => ({
      id: incident.id,
      zoneId: incident.zone_id,
      photo: incident.photo_encrypted ? decryptData(incident.photo_encrypted, ENCRYPTION_KEY) : undefined,
      vehicleColor: incident.vehicle_color,
      vehicleType: incident.vehicle_type,
      licensePlate: incident.license_plate_encrypted
        ? decryptData(incident.license_plate_encrypted, ENCRYPTION_KEY)
        : undefined,
      locationNote: incident.location_note,
      notes: incident.notes_encrypted ? decryptData(incident.notes_encrypted, ENCRYPTION_KEY) : undefined,
      corroborationCount: incident.corroboration_count,
      reportedAt: incident.reported_at,
      expiresAt: incident.expires_at,
    }));

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Alerts fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
