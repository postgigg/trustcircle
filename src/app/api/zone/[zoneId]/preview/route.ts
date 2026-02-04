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

    // Return full zone object for BadgeRenderer
    return NextResponse.json({ zone });
  } catch (error) {
    console.error('Zone preview error:', error);
    return NextResponse.json({ error: 'Failed to fetch zone' }, { status: 500 });
  }
}
