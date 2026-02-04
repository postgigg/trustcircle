import { hashLocation, hashWifiNetworks } from './crypto';

interface PresenceData {
  locationHash: string;
  wifiHash: string | null;
  timestamp: number;
}

export async function getCurrentLocation(): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

export async function getWifiNetworks(): Promise<string[]> {
  // Note: Web API doesn't provide direct WiFi SSID access for privacy reasons
  // In a real implementation, this would need native app capabilities
  // For PWA, we rely primarily on geolocation
  return [];
}

export async function collectPresenceData(): Promise<PresenceData | null> {
  const location = await getCurrentLocation();
  if (!location) return null;

  const locationHash = hashLocation(location.lat, location.lon);
  const wifiNetworks = await getWifiNetworks();
  const wifiHash = wifiNetworks.length > 0 ? hashWifiNetworks(wifiNetworks) : null;

  return {
    locationHash,
    wifiHash,
    timestamp: Date.now(),
  };
}

export function isNighttime(): boolean {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 6;
}

export function isExtendedNighttime(): boolean {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 12;
}

const PRESENCE_LOG_KEY = 'tc_presence_log';

interface StoredPresence {
  date: string;
  locationHash: string;
  confirmed: boolean;
}

export function storeLocalPresence(locationHash: string): void {
  if (typeof window === 'undefined') return;

  const today = new Date().toISOString().split('T')[0];
  const logStr = localStorage.getItem(PRESENCE_LOG_KEY);
  const log: StoredPresence[] = logStr ? JSON.parse(logStr) : [];

  const existing = log.find(p => p.date === today);
  if (!existing) {
    log.push({ date: today, locationHash, confirmed: false });
    localStorage.setItem(PRESENCE_LOG_KEY, JSON.stringify(log));
  }
}

export function getLocalPresenceLog(): StoredPresence[] {
  if (typeof window === 'undefined') return [];
  const logStr = localStorage.getItem(PRESENCE_LOG_KEY);
  return logStr ? JSON.parse(logStr) : [];
}

export function markPresenceConfirmed(date: string): void {
  if (typeof window === 'undefined') return;

  const logStr = localStorage.getItem(PRESENCE_LOG_KEY);
  const log: StoredPresence[] = logStr ? JSON.parse(logStr) : [];

  const entry = log.find(p => p.date === date);
  if (entry) {
    entry.confirmed = true;
    localStorage.setItem(PRESENCE_LOG_KEY, JSON.stringify(log));
  }
}

export function clearPresenceLog(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PRESENCE_LOG_KEY);
}

export function getConfirmedNightsCount(): number {
  const log = getLocalPresenceLog();
  return log.filter(p => p.confirmed).length;
}
