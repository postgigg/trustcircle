import { latLngToCell, cellToLatLng, gridDisk, cellToBoundary } from 'h3-js';
import { sha256 } from './crypto';
import type { MotionPattern } from '@/types';

// H3 Resolution 4 ≈ 1,770 km² per cell (close to 30x30 miles = 2,300 km²)
export const H3_RESOLUTION = 4;

/**
 * Get the H3 cell index for a given lat/lon at resolution 4
 */
export function getH3ZoneId(lat: number, lon: number): string {
  return latLngToCell(lat, lon, H3_RESOLUTION);
}

/**
 * Get the center point of an H3 cell
 */
export function getH3ZoneCenter(h3Index: string): { lat: number; lon: number } {
  const [lat, lon] = cellToLatLng(h3Index);
  return { lat, lon };
}

/**
 * Get the boundary polygon of an H3 cell
 */
export function getH3ZoneBoundary(h3Index: string): Array<{ lat: number; lon: number }> {
  const boundary = cellToBoundary(h3Index);
  return boundary.map(([lat, lon]) => ({ lat, lon }));
}

/**
 * Check if a location is within a specific H3 zone
 */
export function isLocationInH3Zone(lat: number, lon: number, h3Index: string): boolean {
  const locationH3 = getH3ZoneId(lat, lon);
  return locationH3 === h3Index;
}

/**
 * Check if a location is within a zone (including neighboring cells for tolerance)
 * This allows for GPS drift at zone boundaries
 */
export function isLocationInH3ZoneWithTolerance(lat: number, lon: number, h3Index: string): boolean {
  const locationH3 = getH3ZoneId(lat, lon);
  if (locationH3 === h3Index) return true;

  // Check if location is in any immediately adjacent cell
  const neighbors = gridDisk(h3Index, 1);
  return neighbors.includes(locationH3);
}

/**
 * Generate deterministic zone appearance from H3 index
 */
export function generateZoneAppearance(h3Index: string): {
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  motion_pattern: MotionPattern;
} {
  const hash = sha256(h3Index);

  // Generate primary hue from first 8 chars
  const hue = parseInt(hash.slice(0, 8), 16) % 360;

  // Generate saturation variance from next 4 chars
  const satVariance = (parseInt(hash.slice(8, 12), 16) % 20) + 50; // 50-70%

  // Generate lightness variance from next 4 chars
  const lightVariance = (parseInt(hash.slice(12, 16), 16) % 15) + 25; // 25-40%

  // Primary: main hue, medium saturation, darker
  const color_primary = hslToHex(hue, satVariance + 10, lightVariance);

  // Secondary: same hue family, lighter
  const color_secondary = hslToHex(hue, satVariance, lightVariance + 30);

  // Accent: complementary color
  const accentHue = (hue + 120 + (parseInt(hash.slice(16, 20), 16) % 60)) % 360;
  const color_accent = hslToHex(accentHue, 60, 50);

  // Motion pattern from last part of hash
  const patterns: MotionPattern[] = ['wave', 'pulse', 'ripple', 'spiral'];
  const patternIndex = parseInt(hash.slice(20, 24), 16) % patterns.length;
  const motion_pattern = patterns[patternIndex];

  return {
    color_primary,
    color_secondary,
    color_accent,
    motion_pattern,
  };
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Get neighboring H3 zones (for UI map display)
 */
export function getNeighboringZones(h3Index: string, rings: number = 1): string[] {
  return gridDisk(h3Index, rings);
}
