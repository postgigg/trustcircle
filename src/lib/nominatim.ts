import { supabase } from './supabase';

export interface NominatimResult {
  display_name: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
}

interface NominatimAPIResponse {
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

/**
 * Get the best zone name from a Nominatim result
 */
export function getZoneNameFromResult(result: NominatimResult): string {
  // Priority: neighborhood > city > state
  if (result.neighborhood) {
    return result.neighborhood;
  }
  if (result.city) {
    return result.city;
  }
  if (result.state) {
    return result.state;
  }
  // Fallback: extract from display_name
  const parts = result.display_name.split(',').map(p => p.trim());
  return parts[0] || 'Unknown Area';
}

/**
 * Reverse geocode a location using Nominatim
 * Rate limited to 1 request per second
 */
async function fetchFromNominatim(lat: number, lon: number): Promise<NominatimResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TrustCircle/1.0 (https://trustcircle.app)',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const data: NominatimAPIResponse = await response.json();
  const address = data.address || {};

  return {
    display_name: data.display_name,
    city: address.city || address.town || address.village || null,
    state: address.state || null,
    neighborhood: address.neighbourhood || address.suburb || null,
  };
}

/**
 * Get cached zone name or fetch from Nominatim
 */
export async function getZoneName(h3Index: string, lat: number, lon: number): Promise<NominatimResult> {
  // Check cache first
  const { data: cached } = await supabase
    .from('zone_name_cache')
    .select('*')
    .eq('h3_index', h3Index)
    .single();

  if (cached) {
    return {
      display_name: cached.display_name,
      city: cached.city,
      state: cached.state,
      neighborhood: cached.neighborhood,
    };
  }

  // Fetch from Nominatim
  const result = await fetchFromNominatim(lat, lon);

  // Cache the result
  await supabase.from('zone_name_cache').insert({
    h3_index: h3Index,
    display_name: result.display_name,
    city: result.city,
    state: result.state,
    neighborhood: result.neighborhood,
  });

  return result;
}

/**
 * Get zone name with fallback (doesn't throw)
 */
export async function getZoneNameSafe(h3Index: string, lat: number, lon: number): Promise<string> {
  try {
    const result = await getZoneName(h3Index, lat, lon);
    return getZoneNameFromResult(result);
  } catch (error) {
    console.error('Failed to get zone name:', error);
    // Return a shortened version of the H3 index as fallback
    return `Zone ${h3Index.slice(-6).toUpperCase()}`;
  }
}
