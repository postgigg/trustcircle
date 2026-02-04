'use client';

/**
 * Badge Detector - Uses computer vision to detect TrustCircle badges
 * Works offline after initial load using client-side image processing
 */

interface DetectionResult {
  detected: boolean;
  centered: boolean;
  tooFar: boolean;
  tooClose: boolean;
  blurry: boolean;
  guidance: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface ColorCluster {
  r: number;
  g: number;
  b: number;
  count: number;
}

// TrustCircle badge colors (the animated badge uses these)
const BADGE_COLORS = {
  primaryBlue: { r: 27, g: 54, b: 93 },    // #1B365D
  secondaryBlue: { r: 74, g: 144, b: 217 }, // #4A90D9
  white: { r: 255, g: 255, b: 255 },
  // Gradient intermediate colors
  midBlue1: { r: 40, g: 80, b: 130 },
  midBlue2: { r: 55, g: 110, b: 170 },
};

// Tolerance for color matching (increased for better detection)
const COLOR_TOLERANCE = 60;

export class BadgeDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastFrameData: ImageData | null = null;
  private frameHistory: number[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Analyze a video frame for badge detection
   */
  detectBadge(video: HTMLVideoElement): DetectionResult {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
      return {
        detected: false,
        centered: false,
        tooFar: false,
        tooClose: false,
        blurry: true,
        guidance: 'Initializing camera...',
        confidence: 0,
      };
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(video, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, width, height);

    // Check for motion blur
    const isBlurry = this.detectBlur(imageData);

    // Find circular badge-like regions with our colors
    const badgeRegion = this.findBadgeRegion(imageData, width, height);

    if (!badgeRegion) {
      return {
        detected: false,
        centered: false,
        tooFar: false,
        tooClose: false,
        blurry: isBlurry,
        guidance: 'Point camera at a TrustCircle badge',
        confidence: 0,
      };
    }

    // Check if badge is centered
    const centerX = width / 2;
    const centerY = height / 2;
    const badgeCenterX = badgeRegion.x + badgeRegion.width / 2;
    const badgeCenterY = badgeRegion.y + badgeRegion.height / 2;

    const offsetX = Math.abs(badgeCenterX - centerX) / width;
    const offsetY = Math.abs(badgeCenterY - centerY) / height;
    const isCentered = offsetX < 0.15 && offsetY < 0.15;

    // Check size (too far = small, too close = large)
    const badgeSize = Math.max(badgeRegion.width, badgeRegion.height);
    const idealSize = Math.min(width, height) * 0.4;
    const tooFar = badgeSize < idealSize * 0.5;
    const tooClose = badgeSize > idealSize * 1.5;

    // Generate guidance
    let guidance = '';
    if (isBlurry) {
      guidance = 'Hold steady...';
    } else if (tooFar) {
      guidance = 'Move closer';
    } else if (tooClose) {
      guidance = 'Move back';
    } else if (!isCentered) {
      if (badgeCenterX < centerX - width * 0.1) guidance = 'Move left';
      else if (badgeCenterX > centerX + width * 0.1) guidance = 'Move right';
      else if (badgeCenterY < centerY - height * 0.1) guidance = 'Move up';
      else if (badgeCenterY > centerY + height * 0.1) guidance = 'Move down';
      else guidance = 'Center the badge';
    } else {
      guidance = 'Perfect! Scanning...';
    }

    return {
      detected: true,
      centered: isCentered,
      tooFar,
      tooClose,
      blurry: isBlurry,
      guidance,
      confidence: badgeRegion.confidence,
      boundingBox: {
        x: badgeRegion.x,
        y: badgeRegion.y,
        width: badgeRegion.width,
        height: badgeRegion.height,
      },
    };
  }

  /**
   * Detect motion blur by comparing frame differences
   */
  private detectBlur(imageData: ImageData): boolean {
    const data = imageData.data;

    // Calculate Laplacian variance (edge detection)
    let variance = 0;
    let count = 0;
    const width = imageData.width;
    const height = imageData.height;

    // Sample center region
    const startX = Math.floor(width * 0.3);
    const endX = Math.floor(width * 0.7);
    const startY = Math.floor(height * 0.3);
    const endY = Math.floor(height * 0.7);

    for (let y = startY + 1; y < endY - 1; y += 2) {
      for (let x = startX + 1; x < endX - 1; x += 2) {
        const idx = (y * width + x) * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

        // Laplacian approximation
        const top = ((data[((y - 1) * width + x) * 4] + data[((y - 1) * width + x) * 4 + 1] + data[((y - 1) * width + x) * 4 + 2]) / 3);
        const bottom = ((data[((y + 1) * width + x) * 4] + data[((y + 1) * width + x) * 4 + 1] + data[((y + 1) * width + x) * 4 + 2]) / 3);
        const left = ((data[(y * width + x - 1) * 4] + data[(y * width + x - 1) * 4 + 1] + data[(y * width + x - 1) * 4 + 2]) / 3);
        const right = ((data[(y * width + x + 1) * 4] + data[(y * width + x + 1) * 4 + 1] + data[(y * width + x + 1) * 4 + 2]) / 3);

        const laplacian = Math.abs(4 * gray - top - bottom - left - right);
        variance += laplacian;
        count++;
      }
    }

    const avgVariance = variance / count;
    this.frameHistory.push(avgVariance);
    if (this.frameHistory.length > 10) this.frameHistory.shift();

    // Low variance = blurry
    return avgVariance < 8;
  }

  /**
   * Find badge-colored circular region in image
   */
  private findBadgeRegion(
    imageData: ImageData,
    width: number,
    height: number
  ): { x: number; y: number; width: number; height: number; confidence: number } | null {
    const data = imageData.data;

    // Scan for badge colors in a grid
    const gridSize = 20;
    const matches: { x: number; y: number; score: number }[] = [];

    for (let gy = 0; gy < height; gy += gridSize) {
      for (let gx = 0; gx < width; gx += gridSize) {
        let blueCount = 0;
        let whiteCount = 0;
        let totalPixels = 0;

        // Sample pixels in this grid cell
        for (let y = gy; y < Math.min(gy + gridSize, height); y += 2) {
          for (let x = gx; x < Math.min(gx + gridSize, width); x += 2) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Check for any badge blue colors
            if (this.isColorMatch(r, g, b, BADGE_COLORS.primaryBlue) ||
                this.isColorMatch(r, g, b, BADGE_COLORS.secondaryBlue) ||
                this.isColorMatch(r, g, b, BADGE_COLORS.midBlue1) ||
                this.isColorMatch(r, g, b, BADGE_COLORS.midBlue2) ||
                this.isBlueish(r, g, b)) {
              blueCount++;
            }
            if (this.isColorMatch(r, g, b, BADGE_COLORS.white)) {
              whiteCount++;
            }
            totalPixels++;
          }
        }

        const blueRatio = blueCount / totalPixels;
        const whiteRatio = whiteCount / totalPixels;

        // Badge has mix of blue and white
        if (blueRatio > 0.15 || (blueRatio > 0.05 && whiteRatio > 0.1)) {
          matches.push({ x: gx, y: gy, score: blueRatio + whiteRatio * 0.5 });
        }
      }
    }

    if (matches.length < 3) return null;

    // Cluster nearby matches to find badge bounds
    const sortedMatches = matches.sort((a, b) => b.score - a.score);
    const topMatches = sortedMatches.slice(0, Math.min(50, sortedMatches.length));

    if (topMatches.length === 0) return null;

    // Find bounding box of matches
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let totalScore = 0;

    for (const match of topMatches) {
      minX = Math.min(minX, match.x);
      maxX = Math.max(maxX, match.x + gridSize);
      minY = Math.min(minY, match.y);
      maxY = Math.max(maxY, match.y + gridSize);
      totalScore += match.score;
    }

    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;

    // Check if region is roughly circular (aspect ratio near 1)
    const aspectRatio = regionWidth / regionHeight;
    if (aspectRatio < 0.5 || aspectRatio > 2.0) return null;

    // Check minimum size
    if (regionWidth < 50 || regionHeight < 50) return null;

    const confidence = Math.min(1, totalScore / topMatches.length * 2);

    return {
      x: minX,
      y: minY,
      width: regionWidth,
      height: regionHeight,
      confidence,
    };
  }

  /**
   * Check if a pixel color matches a target color
   */
  private isColorMatch(
    r: number,
    g: number,
    b: number,
    target: { r: number; g: number; b: number }
  ): boolean {
    return (
      Math.abs(r - target.r) < COLOR_TOLERANCE &&
      Math.abs(g - target.g) < COLOR_TOLERANCE &&
      Math.abs(b - target.b) < COLOR_TOLERANCE
    );
  }

  /**
   * Check if a pixel is generally blue-ish (matches badge color family)
   */
  private isBlueish(r: number, g: number, b: number): boolean {
    // Blue channel should be dominant
    return b > r * 1.2 && b > g * 0.9 && b > 50;
  }

  /**
   * Extract color signature for verification
   */
  extractColorSignature(video: HTMLVideoElement): number[] {
    const width = video.videoWidth;
    const height = video.videoHeight;

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(video, 0, 0);

    // Sample center region
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.2;

    const imageData = this.ctx.getImageData(
      centerX - radius,
      centerY - radius,
      radius * 2,
      radius * 2
    );

    // Get dominant colors
    const clusters = this.kMeansClusters(imageData.data, 5);
    return clusters.flatMap(c => [c.r, c.g, c.b]);
  }

  /**
   * Simple k-means color clustering
   */
  private kMeansClusters(data: Uint8ClampedArray, k: number): ColorCluster[] {
    const colors: { r: number; g: number; b: number }[] = [];

    // Sample pixels
    for (let i = 0; i < data.length; i += 16) {
      colors.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2],
      });
    }

    // Initialize centroids randomly
    const centroids: ColorCluster[] = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(Math.random() * colors.length);
      centroids.push({ ...colors[idx], count: 0 });
    }

    // Run k-means iterations
    for (let iter = 0; iter < 10; iter++) {
      // Reset counts
      centroids.forEach(c => {
        c.r = 0;
        c.g = 0;
        c.b = 0;
        c.count = 0;
      });

      // Assign colors to nearest centroid
      for (const color of colors) {
        let minDist = Infinity;
        let nearest = centroids[0];

        for (const centroid of centroids) {
          const dist =
            Math.abs(color.r - centroid.r) +
            Math.abs(color.g - centroid.g) +
            Math.abs(color.b - centroid.b);
          if (dist < minDist) {
            minDist = dist;
            nearest = centroid;
          }
        }

        nearest.r += color.r;
        nearest.g += color.g;
        nearest.b += color.b;
        nearest.count++;
      }

      // Update centroids
      for (const centroid of centroids) {
        if (centroid.count > 0) {
          centroid.r = Math.round(centroid.r / centroid.count);
          centroid.g = Math.round(centroid.g / centroid.count);
          centroid.b = Math.round(centroid.b / centroid.count);
        }
      }
    }

    return centroids.sort((a, b) => b.count - a.count);
  }
}

// Singleton instance
let detectorInstance: BadgeDetector | null = null;

export function getBadgeDetector(): BadgeDetector {
  if (!detectorInstance) {
    detectorInstance = new BadgeDetector();
  }
  return detectorInstance;
}
