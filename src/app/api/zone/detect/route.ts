import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getH3ZoneId, generateZoneAppearance, getH3ZoneCenter } from '@/lib/h3-zones';
import { getZoneNameSafe } from '@/lib/nominatim';

export async function POST(request: NextRequest) {
  try {
    const { lat, lon } = await request.json();

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    // Get H3 cell index for this location
    const h3Index = getH3ZoneId(lat, lon);

    // Check if zone already exists in database
    const { data: existingZone } = await supabase
      .from('zones')
      .select('*')
      .eq('h3_index', h3Index)
      .single();

    if (existingZone) {
      return NextResponse.json({ zone: existingZone });
    }

    // Also check old-style zones using boundary hashes (for backward compatibility)
    const { data: legacyZones } = await supabase
      .from('zones')
      .select('*')
      .is('h3_index', null);

    // For legacy zones, we'd need to check if the location hash is in zone_boundary_hashes
    // but since those are pre-defined demo zones, we skip the hash check here

    // Zone doesn't exist yet - return a preview
    // Get zone name from Nominatim (cached)
    const zoneName = await getZoneNameSafe(h3Index, lat, lon);

    // Generate deterministic appearance
    const appearance = generateZoneAppearance(h3Index);

    // Return preview zone (not saved to DB yet)
    const previewZone = {
      zone_id: `h3-${h3Index}`,
      zone_name: zoneName,
      zone_boundary_hashes: null,
      h3_index: h3Index,
      h3_resolution: 4,
      ...appearance,
      active_resident_count: 0,
      created_at: null,
    };

    return NextResponse.json({
      zone: previewZone,
      preview: true,
      message: 'This zone will be created when the first resident signs up',
    });
  } catch (error) {
    console.error('Zone detection error:', error);
    return NextResponse.json({ error: 'Failed to detect zone' }, { status: 500 });
  }
}
