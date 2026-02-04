import { generateBadgeSeed, extractSeedParameters, generateDeviceMicroVariation } from './crypto';

const SEED_SECRET = process.env.BADGE_SEED_SECRET || 'default-secret-change-in-production';

export function generateCurrentSeed(zoneId: string): {
  seed: string;
  validFrom: Date;
  validUntil: Date;
} {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const validFrom = new Date(minute * 60000);
  const validUntil = new Date((minute + 1) * 60000);

  const seed = generateBadgeSeed(zoneId, now, SEED_SECRET);

  return { seed, validFrom, validUntil };
}

export function getSeedForVerification(zoneId: string, timestamp: number): string {
  return generateBadgeSeed(zoneId, timestamp, SEED_SECRET);
}

export function getAnimationParameters(seed: string, deviceToken?: string) {
  const baseParams = extractSeedParameters(seed);

  if (deviceToken) {
    const microVariation = generateDeviceMicroVariation(deviceToken);
    return {
      ...baseParams,
      microVariation,
    };
  }

  return { ...baseParams, microVariation: 0 };
}

export function verifySeedMatch(
  capturedParams: {
    phaseOffset: number;
    speedMultiplier: number;
    colorIntensity: number;
    motionModifier: number;
  },
  expectedParams: {
    phaseOffset: number;
    speedMultiplier: number;
    colorIntensity: number;
    motionModifier: number;
  },
  tolerance: number = 0.15
): boolean {
  const phaseDiff = Math.abs(capturedParams.phaseOffset - expectedParams.phaseOffset);
  const speedDiff = Math.abs(capturedParams.speedMultiplier - expectedParams.speedMultiplier);
  const colorDiff = Math.abs(capturedParams.colorIntensity - expectedParams.colorIntensity);
  const motionDiff = Math.abs(capturedParams.motionModifier - expectedParams.motionModifier);

  const totalDiff = (phaseDiff + speedDiff + colorDiff + motionDiff) / 4;
  return totalDiff <= tolerance;
}

export function hasMicroVariation(samples: number[]): boolean {
  if (samples.length < 10) return false;

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / samples.length;

  return variance > 0.0001 && variance < 0.001;
}
