'use client';

/**
 * Badge Detector - Detects TrustCircle badges by their unique zone colors
 *
 * Zones are loaded from the database via API - NO hardcoded colors.
 * Each zone has a specific color pair that must BOTH be present in significant amounts.
 *
 * Detection requires:
 * - Both primary and secondary colors present
 * - Tight color tolerance to avoid matching random environment colors
 * - Minimum pixel coverage thresholds
 * - Stable detection over multiple frames
 *
 * Invisible Verification Layer:
 * - Samples center brightness each frame
 * - Maintains ring buffer of brightness samples
 * - Decodes 24-bit pattern (16-bit device prefix + 8-bit checksum)
 */

import { decodePattern, PATTERN_CONFIG } from './patternEncoder';

interface DetectionResult {
  detected: boolean;
  ready: boolean;
  guidance: string;
  confidence: number;
  matchedZone?: string;
  patternReady?: boolean;
}

interface PatternResult {
  prefix: number;
  checksum: number;
  confidence: number;
}

interface ZoneColors {
  zone_id: string;
  zone_name: string;
  primary: { r: number; g: number; b: number };
  secondary: { r: number; g: number; b: number };
}

// Detection thresholds - tuned to avoid false positives
const COLOR_TOLERANCE = 40;           // Max color distance for a match (tighter = fewer false positives)
const MIN_PRIMARY_RATIO = 0.08;       // At least 8% of pixels must match primary
const MIN_SECONDARY_RATIO = 0.06;     // At least 6% of pixels must match secondary
const MIN_COMBINED_SCORE = 0.20;      // Combined ratio must exceed this
const STABLE_FRAMES_REQUIRED = 8;     // Frames of stable detection before ready

// Brightness sampling for invisible verification
// Need ~4 seconds of samples at 30fps = 120 samples for full 3.6s cycle + buffer
const BRIGHTNESS_BUFFER_SIZE = 150;
const SAMPLES_PER_BIT = Math.ceil(BRIGHTNESS_BUFFER_SIZE / PATTERN_CONFIG.BITS_TOTAL);

export class BadgeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stableFrames = 0;
  private lastMatchedZone: string | null = null;
  private lastMatchedZoneId: string | null = null;
  private consecutiveNoDetection = 0;
  private zoneColors: ZoneColors[] = [];
  private zonesLoaded = false;
  private loadingZones = false;

  // Brightness sampling for invisible verification
  private brightnessSamples: number[] = [];
  private lastSampleTime = 0;
  private patternExtracted: PatternResult | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Load zone colors from the database via API
   */
  async loadZones(): Promise<void> {
    if (this.zonesLoaded || this.loadingZones) return;

    this.loadingZones = true;
    try {
      const res = await fetch('/api/zones/colors');
      if (res.ok) {
        const data = await res.json();
        this.zoneColors = data.zones.map((zone: { zone_id: string; zone_name: string; color_primary: string; color_secondary: string }) => ({
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          primary: hexToRgb(zone.color_primary),
          secondary: hexToRgb(zone.color_secondary),
        }));
        this.zonesLoaded = true;
      }
    } catch (err) {
      console.error('Failed to load zone colors:', err);
    } finally {
      this.loadingZones = false;
    }
  }

  detectBadge(video: HTMLVideoElement): DetectionResult {
    // Ensure zones are loaded
    if (!this.zonesLoaded) {
      this.loadZones();
      return { detected: false, ready: false, guidance: 'Loading zones...', confidence: 0 };
    }

    if (this.zoneColors.length === 0) {
      return { detected: false, ready: false, guidance: 'No zones available', confidence: 0 };
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
      return { detected: false, ready: false, guidance: 'Starting camera...', confidence: 0 };
    }

    // Sample center of frame at reduced resolution for speed
    const scale = 0.35;
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    this.canvas.width = sw;
    this.canvas.height = sh;
    this.ctx.drawImage(video, 0, 0, sw, sh);

    // Sample center 40% where badge should be - tighter focus area
    const regionSize = Math.floor(Math.min(sw, sh) * 0.4);
    const startX = Math.floor((sw - regionSize) / 2);
    const startY = Math.floor((sh - regionSize) / 2);

    const imageData = this.ctx.getImageData(startX, startY, regionSize, regionSize);
    const data = imageData.data;

    // Check each zone's colors from database
    let bestZone: string | null = null;
    let bestZoneId: string | null = null;
    let bestScore = 0;

    for (const zone of this.zoneColors) {
      let primaryMatches = 0;
      let secondaryMatches = 0;
      let totalPixels = 0;

      // Sample every 4th pixel for speed
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        totalPixels++;

        const primaryDist = colorDistance(r, g, b, zone.primary);
        const secondaryDist = colorDistance(r, g, b, zone.secondary);

        // Use tight tolerance to avoid matching random colors
        if (primaryDist < COLOR_TOLERANCE) primaryMatches++;
        if (secondaryDist < COLOR_TOLERANCE) secondaryMatches++;
      }

      const primaryRatio = primaryMatches / totalPixels;
      const secondaryRatio = secondaryMatches / totalPixels;

      // BOTH colors MUST be present above minimum thresholds
      // This is the key to avoiding false positives - random environments
      // won't have BOTH specific colors in the right amounts
      if (primaryRatio >= MIN_PRIMARY_RATIO && secondaryRatio >= MIN_SECONDARY_RATIO) {
        const score = primaryRatio + secondaryRatio;
        if (score > bestScore) {
          bestScore = score;
          bestZone = zone.zone_name;
          bestZoneId = zone.zone_id;
        }
      }
    }

    // Only count as detected if score exceeds minimum combined threshold
    const detected = bestScore >= MIN_COMBINED_SCORE;

    // Confidence based on how far above threshold we are
    const confidence = detected ? Math.min(1, (bestScore - MIN_COMBINED_SCORE) * 3 + 0.3) : bestScore / MIN_COMBINED_SCORE * 0.3;

    // Track stability - same zone detected for consecutive frames
    if (detected && bestZone === this.lastMatchedZone) {
      this.stableFrames++;
      this.consecutiveNoDetection = 0;
    } else if (detected) {
      // New zone detected - reset counter
      this.stableFrames = 1;
      this.lastMatchedZone = bestZone;
      this.lastMatchedZoneId = bestZoneId;
      this.consecutiveNoDetection = 0;
    } else {
      // No detection - but don't reset immediately to handle brief occlusions
      this.consecutiveNoDetection++;
      if (this.consecutiveNoDetection > 5) {
        this.stableFrames = 0;
        this.lastMatchedZone = null;
        this.lastMatchedZoneId = null;
      }
    }

    // Require stable detection over multiple frames
    const ready = this.stableFrames >= STABLE_FRAMES_REQUIRED;

    let guidance: string;
    if (!detected) {
      if (bestScore > 0.05) {
        guidance = 'Move closer to the badge';
      } else {
        guidance = 'Point at a TrustCircle badge';
      }
    } else if (!ready) {
      const progress = Math.floor((this.stableFrames / STABLE_FRAMES_REQUIRED) * 100);
      guidance = `${bestZone} detected (${progress}%)... hold steady`;
    } else {
      guidance = 'Verifying...';
    }

    // Sample brightness for invisible verification when badge is detected
    if (detected) {
      this.sampleBrightness(imageData.data);
    } else {
      // Reset brightness samples when badge not detected
      this.brightnessSamples = [];
      this.patternExtracted = null;
    }

    // Check if we have enough samples to extract pattern
    const patternReady = this.brightnessSamples.length >= BRIGHTNESS_BUFFER_SIZE;
    if (patternReady && !this.patternExtracted) {
      this.patternExtracted = decodePattern(this.brightnessSamples) || null;
    }

    return {
      detected,
      ready,
      guidance,
      confidence,
      matchedZone: bestZone || undefined,
      patternReady,
    };
  }

  /**
   * Sample center brightness for invisible pattern detection
   */
  private sampleBrightness(data: Uint8ClampedArray): void {
    // Calculate average brightness of center region
    let totalBrightness = 0;
    let pixelCount = 0;

    // Sample every 8th pixel for speed
    for (let i = 0; i < data.length; i += 32) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceived brightness formula
      totalBrightness += 0.299 * r + 0.587 * g + 0.114 * b;
      pixelCount++;
    }

    const avgBrightness = totalBrightness / pixelCount;

    // Add to ring buffer
    this.brightnessSamples.push(avgBrightness);

    // Maintain buffer size
    if (this.brightnessSamples.length > BRIGHTNESS_BUFFER_SIZE) {
      this.brightnessSamples.shift();
    }
  }

  /**
   * Get extracted pattern for verification
   */
  extractPattern(): PatternResult | null {
    if (this.brightnessSamples.length < BRIGHTNESS_BUFFER_SIZE) {
      return null;
    }

    // Decode pattern from brightness samples
    return decodePattern(this.brightnessSamples) || null;
  }

  /**
   * Get current pattern readiness status
   */
  getPatternProgress(): { progress: number; ready: boolean } {
    const progress = Math.min(100, Math.floor((this.brightnessSamples.length / BRIGHTNESS_BUFFER_SIZE) * 100));
    const ready = this.brightnessSamples.length >= BRIGHTNESS_BUFFER_SIZE;
    return { progress, ready };
  }

  extractColorSignature(video: HTMLVideoElement): number[] {
    const width = video.videoWidth;
    const height = video.videoHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(video, 0, 0);

    // Sample center region where badge should be
    const size = Math.floor(Math.min(width, height) * 0.35);
    const startX = Math.floor((width - size) / 2);
    const startY = Math.floor((height - size) / 2);

    const imageData = this.ctx.getImageData(startX, startY, size, size);
    const data = imageData.data;

    // Collect colors that match the DETECTED zone's colors specifically
    const colors: number[] = [];
    const matchedZoneId = this.lastMatchedZoneId;

    if (!matchedZoneId) {
      return [];
    }

    // Find the zone config for matched zone
    const zoneConfig = this.zoneColors.find(z => z.zone_id === matchedZoneId);
    if (!zoneConfig) {
      return [];
    }

    let primaryCount = 0;
    let secondaryCount = 0;

    for (let i = 0; i < data.length && colors.length < 240; i += 8) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const primaryDist = colorDistance(r, g, b, zoneConfig.primary);
      const secondaryDist = colorDistance(r, g, b, zoneConfig.secondary);

      // Only collect pixels that match THIS zone's colors with tight tolerance
      if (primaryDist < COLOR_TOLERANCE + 10) {
        colors.push(r, g, b);
        primaryCount++;
      } else if (secondaryDist < COLOR_TOLERANCE + 10) {
        colors.push(r, g, b);
        secondaryCount++;
      }
    }

    // Must have both colors represented in signature
    if (primaryCount < 5 || secondaryCount < 5) {
      return [];
    }

    // Need substantial signature
    if (colors.length < 60) {
      return [];
    }

    return colors;
  }

  reset() {
    this.stableFrames = 0;
    this.lastMatchedZone = null;
    this.lastMatchedZoneId = null;
    this.consecutiveNoDetection = 0;
    this.brightnessSamples = [];
    this.patternExtracted = null;
  }
}

function colorDistance(
  r: number,
  g: number,
  b: number,
  target: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(r - target.r, 2) +
    Math.pow(g - target.g, 2) +
    Math.pow(b - target.b, 2)
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

let instance: BadgeDetector | null = null;

export function getBadgeDetector(): BadgeDetector {
  if (!instance) {
    instance = new BadgeDetector();
  }
  return instance;
}
