'use client';

/**
 * Badge Detector - Detects TrustCircle badges by looking for
 * the specific animated pattern with our exact colors
 */

interface DetectionResult {
  detected: boolean;
  ready: boolean;
  guidance: string;
  confidence: number;
}

// Exact TrustCircle badge colors - must match these precisely
const BRIARWOOD_COLORS = {
  primary: { r: 27, g: 54, b: 93 },    // #1B365D - dark navy
  secondary: { r: 74, g: 144, b: 217 }, // #4A90D9 - bright blue
};

export class BadgeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stableFrames = 0;

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

    // Sample center of frame at reduced resolution
    const scale = 0.25;
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    this.canvas.width = sw;
    this.canvas.height = sh;
    this.ctx.drawImage(video, 0, 0, sw, sh);

    // Only look at center 40% where badge should be
    const regionSize = Math.floor(Math.min(sw, sh) * 0.4);
    const startX = Math.floor((sw - regionSize) / 2);
    const startY = Math.floor((sh - regionSize) / 2);

    const imageData = this.ctx.getImageData(startX, startY, regionSize, regionSize);
    const data = imageData.data;

    // Count pixels that match our EXACT badge colors (with tolerance)
    let primaryMatches = 0;
    let secondaryMatches = 0;
    let totalPixels = 0;

    // Check every 4th pixel for speed
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalPixels++;

      // Check primary color match (dark navy blue)
      const primaryDist = colorDistance(r, g, b, BRIARWOOD_COLORS.primary);
      if (primaryDist < 50) {
        primaryMatches++;
      }

      // Check secondary color match (bright blue)
      const secondaryDist = colorDistance(r, g, b, BRIARWOOD_COLORS.secondary);
      if (secondaryDist < 50) {
        secondaryMatches++;
      }
    }

    const primaryRatio = primaryMatches / totalPixels;
    const secondaryRatio = secondaryMatches / totalPixels;

    // STRICT: Need BOTH colors present in significant amounts
    // Real badge has gradient so should have both
    const hasPrimary = primaryRatio > 0.08;  // At least 8% dark blue
    const hasSecondary = secondaryRatio > 0.05; // At least 5% bright blue
    const detected = hasPrimary && hasSecondary;

    const confidence = detected ? Math.min(1, (primaryRatio + secondaryRatio) * 3) : 0;

    // Track stability - need 8 consecutive frames
    if (detected) {
      this.stableFrames++;
    } else {
      this.stableFrames = 0;
    }

    const ready = this.stableFrames >= 8;

    // Guidance
    let guidance: string;
    if (!detected) {
      guidance = 'Point at a TrustCircle badge';
    } else if (!ready) {
      guidance = 'Hold steady...';
    } else {
      guidance = 'Verifying...';
    }

    return { detected, ready, guidance, confidence };
  }

  extractColorSignature(video: HTMLVideoElement): number[] {
    const width = video.videoWidth;
    const height = video.videoHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(video, 0, 0);

    // Sample center region
    const size = Math.floor(Math.min(width, height) * 0.3);
    const startX = Math.floor((width - size) / 2);
    const startY = Math.floor((height - size) / 2);

    const imageData = this.ctx.getImageData(startX, startY, size, size);
    const data = imageData.data;

    // Collect actual badge-colored pixels only
    const colors: number[] = [];

    for (let i = 0; i < data.length && colors.length < 150; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Only include pixels that are close to our badge colors
      const primaryDist = colorDistance(r, g, b, BRIARWOOD_COLORS.primary);
      const secondaryDist = colorDistance(r, g, b, BRIARWOOD_COLORS.secondary);

      if (primaryDist < 60 || secondaryDist < 60) {
        colors.push(r, g, b);
      }
    }

    // If we didn't find enough badge-colored pixels, detection was wrong
    if (colors.length < 30) {
      console.log('Not enough badge colors found:', colors.length / 3, 'pixels');
      return [];
    }

    return colors;
  }

  reset() {
    this.stableFrames = 0;
  }
}

function colorDistance(r: number, g: number, b: number, target: { r: number; g: number; b: number }): number {
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
