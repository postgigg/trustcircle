import { NextResponse } from 'next/server';
import { getAllZones } from '@/lib/supabase';

/**
 * Returns all zones with their colors for badge detection
 * Used by the client-side BadgeDetector to identify which zone a badge belongs to
 */
export async function GET() {
  try {
    const zones = await getAllZones();

    if (!zones || zones.length === 0) {
      return NextResponse.json({ zones: [] });
    }

    // Return only the fields needed for badge detection
    const zoneColors = zones.map(zone => ({
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      color_primary: zone.color_primary,
      color_secondary: zone.color_secondary,
    }));

    return NextResponse.json({ zones: zoneColors });
  } catch (error) {
    console.error('Failed to fetch zone colors:', error);
    return NextResponse.json({ zones: [] });
  }
}
