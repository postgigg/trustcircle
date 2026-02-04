'use client';

/**
 * Badge Detector - Fast, stable detection for TrustCircle badges
 * Optimized for quick detection (<5 seconds) with screen-displayed badges
 */

interface DetectionResult {
  detected: boolean;
  centered: boolean;
  ready: boolean;
  guidance: string;
  confidence: number;
}

// TrustCircle badge color families
const BADGE_COLORS = [
  // Blue family (Briarwood, TrustCircle Demo)
  { primary: { r: 27, g: 54, b: 93 }, secondary: { r: 74, g: 144, b: 217 }, name: 'blue' },
  // Green family (Oak Ridge)
  { primary: { r: 45, g: 80, b: 22 }, secondary: { r: 107, g: 142, b: 35 }, name: 'green' },
  // Teal family (Riverside)
  { primary: { r: 26, g: 77, b: 92 }, secondary: { r: 78, g: 205, b: 196 }, name: 'teal' },
  // Orange family (Maplewood)
  { primary: { r: 139, g: 69, b: 19 }, secondary: { r: 210, g: 105, b: 30 }, name: 'orange' },
];

export class BadgeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stableFrames = 0;
  private lastDetected = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Fast badge detection - optimized for speed
   */
  detectBadge(video: HTMLVideoElement): DetectionResult {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
      return {
        detected: false,
        centered: false,
        ready: false,
        guidance: 'Starting camera...',
        confidence: 0,
      };
    }

    // Use smaller canvas for faster processing
    const scale = 0.25;
    const sw = Math.floor(width * scale);
    const sh = Math.floor(height * scale);

    this.canvas.width = sw;
    this.canvas.height = sh;
    this.ctx.drawImage(video, 0, 0, sw, sh);

    // Sample center region only (where badge should be)
    const centerX = sw / 2;
    const centerY = sh / 2;
    const sampleSize = Math.min(sw, sh) * 0.4;

    const startX = Math.floor(centerX - sampleSize / 2);
    const startY = Math.floor(centerY - sampleSize / 2);
    const regionSize = Math.floor(sampleSize);

    const imageData = this.ctx.getImageData(startX, startY, regionSize, regionSize);
    const data = imageData.data;

    // Quick color analysis
    let blueCount = 0;
    let greenCount = 0;
    let tealCount = 0;
    let orangeCount = 0;
    let totalSampled = 0;

    // Sample every 4th pixel for speed
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalSampled++;

      // Blue detection (b dominant, not too bright)
      if (b > r * 1.2 && b > g * 0.8 && b > 40 && b < 240) {
        blueCount++;
      }
      // Green detection (g dominant)
      if (g > r * 1.1 && g > b * 1.1 && g > 40 && g < 240) {
        greenCount++;
      }
      // Teal detection (g and b both high, r low)
      if (g > r * 1.3 && b > r * 1.3 && g > 60 && b > 60) {
        tealCount++;
      }
      // Orange detection (r high, g medium, b low)
      if (r > g * 1.1 && r > b * 2 && r > 80 && g > 40) {
        orangeCount++;
      }
    }

    const blueRatio = blueCount / totalSampled;
    const greenRatio = greenCount / totalSampled;
    const tealRatio = tealCount / totalSampled;
    const orangeRatio = orangeCount / totalSampled;

    // Detect if any badge color family is present
    const threshold = 0.15; // 15% of pixels need to match
    const detected = blueRatio > threshold ||
                     greenRatio > threshold ||
                     tealRatio > threshold ||
                     orangeRatio > threshold;

    // Calculate confidence
    const maxRatio = Math.max(blueRatio, greenRatio, tealRatio, orangeRatio);
    const confidence = Math.min(1, maxRatio * 3);

    // Track stability
    if (detected) {
      if (this.lastDetected) {
        this.stableFrames++;
      } else {
        this.stableFrames = 1;
      }
    } else {
      this.stableFrames = 0;
    }
    this.lastDetected = detected;

    // Ready after just 5 stable frames (~0.5 seconds at 10fps)
    const ready = this.stableFrames >= 5;

    // Simple guidance
    let guidance: string;
    if (!detected) {
      guidance = 'Point at a TrustCircle badge';
    } else if (confidence < 0.3) {
      guidance = 'Move closer';
    } else if (ready) {
      guidance = 'Verifying...';
    } else {
      guidance = 'Hold steady...';
    }

    return {
      detected,
      centered: detected && confidence > 0.25,
      ready,
      guidance,
      confidence,
    };
  }

  /**
   * Extract color signature for API verification
   * Samples many pixels from center to get accurate color representation
   */
  extractColorSignature(video: HTMLVideoElement): number[] {
    const width = video.videoWidth;
    const height = video.videoHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(video, 0, 0);

    // Sample center region (where badge should be)
    const centerX = width / 2;
    const centerY = height / 2;
    const sampleSize = Math.min(width, height) * 0.3; // 30% of smallest dimension

    const startX = Math.floor(centerX - sampleSize / 2);
    const startY = Math.floor(centerY - sampleSize / 2);
    const regionSize = Math.floor(sampleSize);

    const imageData = this.ctx.getImageData(startX, startY, regionSize, regionSize);
    const data = imageData.data;

    // Sample 50 pixels evenly distributed across the region
    const colors: number[] = [];
    const pixelCount = data.length / 4;
    const step = Math.max(1, Math.floor(pixelCount / 50));

    for (let p = 0; p < pixelCount && colors.length < 150; p += step) {
      const i = p * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip very dark pixels (likely shadows/black areas)
      if (r + g + b < 30) continue;
      // Skip very bright pixels (likely white/highlights)
      if (r > 240 && g > 240 && b > 240) continue;

      colors.push(r, g, b);
    }

    console.log('Extracted colors sample:', colors.slice(0, 15));
    return colors;
  }

  reset() {
    this.stableFrames = 0;
    this.lastDetected = false;
  }
}

// Singleton
let instance: BadgeDetector | null = null;

export function getBadgeDetector(): BadgeDetector {
  if (!instance) {
    instance = new BadgeDetector();
  }
  return instance;
}
