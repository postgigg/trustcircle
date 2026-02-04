import CryptoJS from 'crypto-js';

export function sha256(input: string): string {
  return CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex);
}

export function hashLocation(lat: number, lon: number): string {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLon = Math.round(lon * 1000) / 1000;
  return sha256(`${roundedLat}:${roundedLon}`);
}

export function hashWifiNetworks(ssids: string[]): string {
  const sorted = [...ssids].sort();
  return sha256(sorted.join('|'));
}

export function hashPin(pin: string, salt: string): string {
  return sha256(`${pin}:${salt}`);
}

export function generateDeviceSalt(): string {
  const array = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function encryptData(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

export function decryptData(encrypted: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function generateBadgeSeed(zoneId: string, timestamp: number, secret: string): string {
  const minute = Math.floor(timestamp / 60000);
  return sha256(`${zoneId}:${minute}:${secret}`);
}

export function extractSeedParameters(seed: string): {
  phaseOffset: number;
  speedMultiplier: number;
  colorIntensity: number;
  motionModifier: number;
} {
  // Hash the seed first to ensure we always have a valid hex string
  const hashedSeed = sha256(seed);
  const phaseOffset = parseInt(hashedSeed.slice(0, 8), 16) / 0xffffffff;
  const speedMultiplier = 0.8 + (parseInt(hashedSeed.slice(8, 16), 16) / 0xffffffff) * 0.4;
  const colorIntensity = 0.7 + (parseInt(hashedSeed.slice(16, 24), 16) / 0xffffffff) * 0.3;
  const motionModifier = parseInt(hashedSeed.slice(24, 32), 16) / 0xffffffff;
  return { phaseOffset, speedMultiplier, colorIntensity, motionModifier };
}

export function generateDeviceMicroVariation(deviceToken: string): number {
  const hash = sha256(deviceToken);
  return (parseInt(hash.slice(0, 8), 16) / 0xffffffff) * 0.02;
}
