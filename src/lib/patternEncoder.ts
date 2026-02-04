/**
 * Pattern Encoder - Invisible device verification layer
 *
 * Encodes device identity + rotating secret into brightness pulses:
 * - 24 bits total: 16-bit device prefix + 8-bit checksum
 * - 150ms per bit = 3.6 second cycle
 * - Brightness: ±2% (0.98 or 1.02 multiplier)
 * - Imperceptible to humans, detectable by camera at 30fps
 */

const BITS_TOTAL = 24;
const BIT_DURATION_MS = 150;
const CYCLE_DURATION_MS = BITS_TOTAL * BIT_DURATION_MS; // 3600ms = 3.6s
const BRIGHTNESS_LOW = 0.98;
const BRIGHTNESS_HIGH = 1.02;

/**
 * Generate 24-bit verification pattern from device token and secret
 *
 * Pattern structure:
 * - Bits 0-15: First 16 bits of device_token (for O(1) DB lookup)
 * - Bits 16-23: 8-bit checksum from sha256(device_token + secret)
 */
export async function generatePattern(
  deviceToken: string,
  secret: string
): Promise<boolean[]> {
  // Get first 16 bits from device token (hex prefix)
  const prefix = deviceTokenToPrefix(deviceToken);

  // Compute 8-bit checksum from sha256(token + secret)
  const checksum = await computeChecksum(deviceToken, secret);

  // Combine into 24-bit pattern
  const pattern: boolean[] = [];

  // First 16 bits: device prefix
  for (let i = 15; i >= 0; i--) {
    pattern.push(((prefix >> i) & 1) === 1);
  }

  // Last 8 bits: checksum
  for (let i = 7; i >= 0; i--) {
    pattern.push(((checksum >> i) & 1) === 1);
  }

  return pattern;
}

/**
 * Extract first 16 bits from device token for DB lookup prefix
 */
export function deviceTokenToPrefix(deviceToken: string): number {
  // Take first 4 hex characters (16 bits)
  const hexPrefix = deviceToken.slice(0, 4).toLowerCase();
  return parseInt(hexPrefix, 16) || 0;
}

/**
 * Convert 16-bit prefix back to hex string for DB query
 */
export function prefixToHex(prefix: number): string {
  return prefix.toString(16).padStart(4, '0').toLowerCase();
}

/**
 * Compute 8-bit checksum from sha256(deviceToken + secret)
 */
async function computeChecksum(
  deviceToken: string,
  secret: string
): Promise<number> {
  const data = deviceToken + secret;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = new Uint8Array(hashBuffer);

  // Take first byte (8 bits) of hash
  return hashArray[0];
}

/**
 * Compute checksum for server-side verification (Node.js compatible)
 */
export function computeChecksumSync(
  deviceToken: string,
  secretHash: string
): number {
  // Server uses the secret hash directly since we store hash, not plaintext
  const crypto = require('crypto');
  const hash = crypto
    .createHash('sha256')
    .update(deviceToken + secretHash)
    .digest();

  return hash[0];
}

/**
 * Get brightness multiplier for current time position in pattern
 *
 * @param pattern - 24-bit boolean array
 * @param timeMs - Current animation time in milliseconds
 * @returns Brightness multiplier (0.98 or 1.02)
 */
export function getPatternMultiplier(
  pattern: boolean[],
  timeMs: number
): number {
  if (!pattern || pattern.length !== BITS_TOTAL) {
    return 1.0; // No pattern, no modification
  }

  // Calculate position in the pattern cycle
  const cyclePosition = timeMs % CYCLE_DURATION_MS;
  const bitIndex = Math.floor(cyclePosition / BIT_DURATION_MS);

  // Clamp to valid range
  const safeIndex = Math.min(Math.max(bitIndex, 0), BITS_TOTAL - 1);

  // Return brightness based on bit value
  return pattern[safeIndex] ? BRIGHTNESS_HIGH : BRIGHTNESS_LOW;
}

/**
 * Decode brightness samples into 24-bit pattern
 *
 * @param brightnessSamples - Array of brightness values sampled at regular intervals
 * @returns Decoded prefix (16 bits) and checksum (8 bits)
 */
export function decodePattern(brightnessSamples: number[]): {
  prefix: number;
  checksum: number;
  confidence: number;
} | null {
  if (brightnessSamples.length < BITS_TOTAL * 2) {
    return null; // Need at least 2 samples per bit for reliable detection
  }

  // Calculate samples per bit
  const samplesPerBit = Math.floor(brightnessSamples.length / BITS_TOTAL);

  // Decode each bit by averaging samples in that bit's window
  const bits: boolean[] = [];
  let totalConfidence = 0;

  // Calculate overall average brightness for threshold
  const avgBrightness =
    brightnessSamples.reduce((a, b) => a + b, 0) / brightnessSamples.length;

  for (let bitIndex = 0; bitIndex < BITS_TOTAL; bitIndex++) {
    const startSample = bitIndex * samplesPerBit;
    const endSample = Math.min(startSample + samplesPerBit, brightnessSamples.length);

    // Average brightness for this bit
    let bitSum = 0;
    let bitCount = 0;
    for (let i = startSample; i < endSample; i++) {
      bitSum += brightnessSamples[i];
      bitCount++;
    }
    const bitAvg = bitSum / bitCount;

    // Determine bit value: above average = 1, below = 0
    const bit = bitAvg > avgBrightness;
    bits.push(bit);

    // Confidence: how far from the average (normalized)
    const deviation = Math.abs(bitAvg - avgBrightness) / avgBrightness;
    totalConfidence += Math.min(deviation * 50, 1); // Scale deviation to 0-1
  }

  // Extract prefix (first 16 bits) and checksum (last 8 bits)
  let prefix = 0;
  for (let i = 0; i < 16; i++) {
    if (bits[i]) {
      prefix |= 1 << (15 - i);
    }
  }

  let checksum = 0;
  for (let i = 0; i < 8; i++) {
    if (bits[16 + i]) {
      checksum |= 1 << (7 - i);
    }
  }

  const confidence = totalConfidence / BITS_TOTAL;

  return { prefix, checksum, confidence };
}

/**
 * Generate a random secret for badge rotation
 */
export function generateSecret(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a secret for storage in database
 */
export async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Export constants for configuration
export const PATTERN_CONFIG = {
  BITS_TOTAL,
  BIT_DURATION_MS,
  CYCLE_DURATION_MS,
  BRIGHTNESS_LOW,
  BRIGHTNESS_HIGH,
} as const;
