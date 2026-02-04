'use client';

/**
 * Badge Detector - Detects TrustCircle badges by their unique zone colors
 * Each zone has a specific color pair that must both be present
 */

interface DetectionResult {
  detected: boolean;
  ready: boolean;
  guidance: string;
  confidence: number;
  matchedZone?: string;
}

// Zone color definitions - must match DEMO_ZONES in API and demo pages
const ZONE_COLORS = [
  {
    name: 'Briarwood',
    primary: { r: 27, g: 54, b: 93 },     // #1B365D dark navy
    secondary: { r: 74, g: 144, b: 217 }, // #4A90D9 bright blue
  },
  {
    name: 'Oak Ridge',
    primary: { r: 45, g: 80, b: 22 },     // #2D5016 dark green
    secondary: { r: 107, g: 142, b: 35 }, // #6B8E23 olive green
  },
  {
    name: 'Riverside',
    primary: { r: 26, g: 77, b: 92 },     // #1A4D5C dark teal
    secondary: { r: 78, g: 205, b: 196 }, // #4ECDC4 bright teal
  },
  {
    name: 'Maplewood',
    primary: { r: 139, g: 69, b: 19 },    // #8B4513 saddle brown
    secondary: { r: 210, g: 105, b: 30 }, // #D2691E chocolate orange
  },
];

export class BadgeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stableFrames = 0;
  private lastMatchedZone: string | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  detectBadge(video: HTMLVideoElement): DetectionResult {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
      return { detected: false, ready: false, guidance: 'Starting camera...', confidence: 0 };
    }

    // Sample center of frame at reduced resolution for speed
    const scale = 0.3;
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    this.canvas.width = sw;
    this.canvas.height = sh;
    this.ctx.drawImage(video, 0, 0, sw, sh);

    // Sample center 50% where badge should be
    const regionSize = Math.floor(Math.min(sw, sh) * 0.5);
    const startX = Math.floor((sw - regionSize) / 2);
    const startY = Math.floor((sh - regionSize) / 2);

    const imageData = this.ctx.getImageData(startX, startY, regionSize, regionSize);
    const data = imageData.data;

    // Check each zone's colors
    let bestZone: string | null = null;
    let bestScore = 0;

    for (const zone of ZONE_COLORS) {
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

        // Tolerance of 55 for color match
        if (primaryDist < 55) primaryMatches++;
        if (secondaryDist < 55) secondaryMatches++;
      }

      const primaryRatio = primaryMatches / totalPixels;
      const secondaryRatio = secondaryMatches / totalPixels;

      // Need BOTH colors present - this is key to avoid false positives
      // At least 5% of each color
      if (primaryRatio > 0.05 && secondaryRatio > 0.03) {
        const score = primaryRatio + secondaryRatio;
        if (score > bestScore) {
          bestScore = score;
          bestZone = zone.name;
        }
      }
    }

    const detected = bestScore > 0.12;
    const confidence = Math.min(1, bestScore * 4);

    // Track stability - same zone detected for consecutive frames
    if (detected && bestZone === this.lastMatchedZone) {
      this.stableFrames++;
    } else if (detected) {
      this.stableFrames = 1;
      this.lastMatchedZone = bestZone;
    } else {
      this.stableFrames = 0;
      this.lastMatchedZone = null;
    }

    // Need 10 stable frames (~1 second at 10fps)
    const ready = this.stableFrames >= 10;

    let guidance: string;
    if (!detected) {
      guidance = 'Point at a TrustCircle badge';
    } else if (!ready) {
      guidance = `Detecting ${bestZone}... hold steady`;
    } else {
      guidance = 'Verifying...';
    }

    return {
      detected,
      ready,
      guidance,
      confidence,
      matchedZone: bestZone || undefined,
    };
  }

  extractColorSignature(video: HTMLVideoElement): number[] {
    const width = video.videoWidth;
    const height = video.videoHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(video, 0, 0);

    // Sample center region
    const size = Math.floor(Math.min(width, height) * 0.35);
    const startX = Math.floor((width - size) / 2);
    const startY = Math.floor((height - size) / 2);

    const imageData = this.ctx.getImageData(startX, startY, size, size);
    const data = imageData.data;

    // Collect colors that match ANY zone's colors
    const colors: number[] = [];

    for (let i = 0; i < data.length && colors.length < 180; i += 8) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if this pixel matches any zone color
      for (const zone of ZONE_COLORS) {
        const primaryDist = colorDistance(r, g, b, zone.primary);
        const secondaryDist = colorDistance(r, g, b, zone.secondary);

        if (primaryDist < 60 || secondaryDist < 60) {
          colors.push(r, g, b);
          break;
        }
      }
    }

    // Need at least 10 badge-colored pixels
    if (colors.length < 30) {
      return [];
    }

    return colors;
  }

  reset() {
    this.stableFrames = 0;
    this.lastMatchedZone = null;
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

let instance: BadgeDetector | null = null;

export function getBadgeDetector(): BadgeDetector {
  if (!instance) {
    instance = new BadgeDetector();
  }
  return instance;
}
