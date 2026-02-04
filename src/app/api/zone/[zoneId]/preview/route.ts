import { NextRequest, NextResponse } from 'next/server';
import { getZoneById } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  try {
    const { zoneId } = await params;
    const zone = await getZoneById(zoneId);

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    return NextResponse.json({
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      color_primary: zone.color_primary,
      color_secondary: zone.color_secondary,
      color_accent: zone.color_accent,
      motion_pattern: zone.motion_pattern,
      active_resident_count: zone.active_resident_count,
    });
  } catch (error) {
    console.error('Zone preview error:', error);
    return NextResponse.json({ error: 'Failed to fetch zone' }, { status: 500 });
  }
}
