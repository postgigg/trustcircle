/**
 * Client-side Security Library
 * All data stays in localStorage - NEVER transmitted to server
 * Server only sees: fingerprint hash, IP (from headers), and threat type (when reported)
 */

const SECURITY_STORAGE_KEY = 'trustcircle_security';

export interface DeviceSignals {
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  pixelRatio: number;
  timezone: string;
  language: string;
  hasWebGL: boolean;
  hasTouch: boolean;
  connectionType: string | null;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  collectedAt: number;
}

export interface IPInfo {
  ip: string;
  fetchedAt: number;
  country?: string;
  region?: string;
  city?: string;
  isp?: string;
}

export interface SecurityState {
  isEmulator: boolean;
  isHeadless: boolean;
  isAutomation: boolean;
  hasInconsistencies: boolean;
  inconsistencyFlags: string[];
  riskScore: number;
  lastChecked: number;
}

export interface LocalSecurityData {
  deviceSignals?: DeviceSignals;
  ipInfo?: IPInfo;
  securityState?: SecurityState;
  usedNonces: string[];
  localThreats: Array<{
    type: string;
    detectedAt: number;
    reported: boolean;
  }>;
}

/**
 * Get security data from localStorage
 */
export function getSecurityData(): LocalSecurityData | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(SECURITY_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Save security data to localStorage
 */
export function saveSecurityData(data: LocalSecurityData): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save security data:', error);
  }
}

/**
 * Collect device signals - STAYS IN LOCALSTORAGE
 */
export async function collectDeviceSignals(): Promise<DeviceSignals> {
  const signals: DeviceSignals = {
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    platform: navigator.platform || 'unknown',
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    language: navigator.language || 'unknown',
    hasWebGL: !!getWebGLContext(),
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    connectionType: getNetworkType(),
    batteryLevel: null,
    batteryCharging: null,
    collectedAt: Date.now(),
  };

  // Get battery info (async)
  const battery = await getBatteryInfo();
  if (battery) {
    signals.batteryLevel = battery.level;
    signals.batteryCharging = battery.charging;
  }

  return signals;
}

/**
 * Get WebGL context for detection
 */
function getWebGLContext(): WebGLRenderingContext | null {
  try {
    const canvas = document.createElement('canvas');
    return (
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

/**
 * Get network connection type
 */
function getNetworkType(): string | null {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; type?: string };
  }).connection;

  if (connection) {
    return connection.effectiveType || connection.type || null;
  }

  return null;
}

/**
 * Get battery info (stays local)
 */
export async function getBatteryInfo(): Promise<{ level: number; charging: boolean } | null> {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };

    if (nav.getBattery) {
      const battery = await nav.getBattery();
      return {
        level: battery.level,
        charging: battery.charging,
      };
    }
  } catch {
    // Battery API not available
  }

  return null;
}

/**
 * Get network info (stays local)
 */
export function getNetworkInfo(): { type: string; downlink: number; rtt: number } | null {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  }).connection;

  if (connection) {
    return {
      type: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
    };
  }

  return null;
}

/**
 * Fetch and store IP info from external service (ip-api.com)
 * This IP is only stored in localStorage, not sent to our server
 */
export async function fetchAndStoreIP(): Promise<IPInfo | null> {
  try {
    // Use ip-api.com (free, no API key needed, 45 req/min limit)
    const response = await fetch(
      'http://ip-api.com/json/?fields=query,country,regionName,city,isp',
      { mode: 'cors' }
    );

    if (!response.ok) {
      throw new Error('IP fetch failed');
    }

    const data = await response.json();

    const ipInfo: IPInfo = {
      ip: data.query,
      country: data.country,
      region: data.regionName,
      city: data.city,
      isp: data.isp,
      fetchedAt: Date.now(),
    };

    // Store in localStorage only
    const securityData = getSecurityData() || { usedNonces: [], localThreats: [] };
    securityData.ipInfo = ipInfo;
    saveSecurityData(securityData);

    return ipInfo;
  } catch (error) {
    console.error('Failed to fetch IP info:', error);

    // Try HTTPS fallback with ipify (only returns IP, no geo)
    try {
      const fallbackResponse = await fetch('https://api.ipify.org?format=json');
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const ipInfo: IPInfo = {
          ip: fallbackData.ip,
          fetchedAt: Date.now(),
        };

        const securityData = getSecurityData() || { usedNonces: [], localThreats: [] };
        securityData.ipInfo = ipInfo;
        saveSecurityData(securityData);

        return ipInfo;
      }
    } catch {
      // Fallback also failed
    }

    return null;
  }
}

/**
 * Get stored IP info
 */
export function getStoredIPInfo(): IPInfo | null {
  const data = getSecurityData();
  return data?.ipInfo || null;
}

/**
 * Detect if running in an emulator
 */
export function detectEmulator(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent.toLowerCase();
  const emulatorIndicators = [
    'android sdk',
    'emulator',
    'sdk_gphone',
    'goldfish',
    'ranchu',
    'generic_x86',
    'vbox',
    'virtualbox',
    'genymotion',
  ];

  for (const indicator of emulatorIndicators) {
    if (ua.includes(indicator)) return true;
  }

  // Check WebGL renderer for VM indicators
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        const vmIndicators = ['swiftshader', 'llvmpipe', 'virtualbox', 'vmware'];
        for (const indicator of vmIndicators) {
          if (renderer.includes(indicator)) return true;
        }
      }
    }
  } catch {
    // WebGL not available
  }

  return false;
}

/**
 * Detect headless browser
 */
export function detectHeadless(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for headless indicators
  const indicators = [
    // Chrome headless
    navigator.webdriver === true,
    // Missing plugins
    navigator.plugins?.length === 0,
    // Missing languages
    !navigator.languages || navigator.languages.length === 0,
    // Phantom indicators
    window.hasOwnProperty('_phantom'),
    window.hasOwnProperty('__nightmare'),
    // Chrome DevTools Protocol
    !!(window as Window & { chrome?: { runtime?: unknown } }).chrome?.runtime,
  ];

  // Check user agent for headless
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('headless')) return true;

  // Return true if 2+ indicators present
  return indicators.filter(Boolean).length >= 2;
}

/**
 * Detect automation tools
 */
export function detectAutomation(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for webdriver
  if (navigator.webdriver === true) return true;

  // Check for automation globals
  const automationGlobals = [
    '__webdriver_script_fn',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '__driver_unwrapped',
    '__webdriver_unwrapped',
    '__selenium_unwrapped',
    '__fxdriver_unwrapped',
    '_selenium',
    'calledSelenium',
    '_Selenium_IDE_Recorder',
    '__webdriver_script_function',
    '__webdriverFunc',
    '$cdc_asdjflasutopfhvcZLmcfl_',
    '$chrome_asyncScriptInfo',
  ];

  for (const global of automationGlobals) {
    if ((window as unknown as Record<string, unknown>)[global] !== undefined) {
      return true;
    }
  }

  // Check document for automation attributes
  const documentElement = document.documentElement;
  if (
    documentElement.getAttribute('webdriver') !== null ||
    documentElement.getAttribute('driver') !== null
  ) {
    return true;
  }

  return false;
}

/**
 * Detect inconsistencies in device signals
 */
export function detectInconsistencies(): { hasInconsistencies: boolean; flags: string[] } {
  const flags: string[] = [];

  // Check for impossible combinations
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  // Mobile UA but desktop platform
  if (/Android|iPhone|iPad/i.test(ua) && /Win|Mac|Linux/i.test(platform) && !/arm/i.test(platform)) {
    flags.push('ua_platform_mismatch');
  }

  // Touch device but no touch points
  if (/Android|iPhone|iPad/i.test(ua) && navigator.maxTouchPoints === 0) {
    flags.push('touch_mismatch');
  }

  // High resolution but low color depth
  if (window.screen.width > 1920 && window.screen.colorDepth < 24) {
    flags.push('display_mismatch');
  }

  // Very high hardware concurrency on mobile (suspicious)
  if (/Android|iPhone/i.test(ua) && navigator.hardwareConcurrency > 16) {
    flags.push('suspicious_cpu_count');
  }

  // No plugins and not iOS (Safari iOS has no plugins API)
  if (navigator.plugins?.length === 0 && !/iPhone|iPad/i.test(ua)) {
    flags.push('no_plugins');
  }

  return {
    hasInconsistencies: flags.length > 0,
    flags,
  };
}

/**
 * Calculate local risk score (never sent to server)
 */
export function calculateLocalRiskScore(): number {
  let score = 0;

  // Emulator detection
  if (detectEmulator()) {
    score += 0.30;
  }

  // Headless detection
  if (detectHeadless()) {
    score += 0.40;
  }

  // Automation detection
  if (detectAutomation()) {
    score += 0.40;
  }

  // Inconsistencies
  const { flags } = detectInconsistencies();
  score += flags.length * 0.10;

  // Cap at 1.0
  return Math.min(score, 1.0);
}

/**
 * Generate a nonce for request signing
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if nonce was used locally
 */
export function isNonceUsedLocally(nonce: string): boolean {
  const data = getSecurityData();
  return data?.usedNonces.includes(nonce) || false;
}

/**
 * Mark nonce as used locally (keep last 100)
 */
export function markNonceUsedLocally(nonce: string): void {
  const data = getSecurityData() || { usedNonces: [], localThreats: [] };

  if (!data.usedNonces.includes(nonce)) {
    data.usedNonces.push(nonce);

    // Keep only last 100 nonces
    if (data.usedNonces.length > 100) {
      data.usedNonces = data.usedNonces.slice(-100);
    }

    saveSecurityData(data);
  }
}

/**
 * Run full security check and update state
 */
export async function runSecurityCheck(): Promise<SecurityState> {
  const isEmulator = detectEmulator();
  const isHeadless = detectHeadless();
  const isAutomation = detectAutomation();
  const { hasInconsistencies, flags } = detectInconsistencies();
  const riskScore = calculateLocalRiskScore();

  const state: SecurityState = {
    isEmulator,
    isHeadless,
    isAutomation,
    hasInconsistencies,
    inconsistencyFlags: flags,
    riskScore,
    lastChecked: Date.now(),
  };

  // Save to localStorage
  const data = getSecurityData() || { usedNonces: [], localThreats: [] };
  data.securityState = state;
  saveSecurityData(data);

  return state;
}

/**
 * Record a local threat detection
 */
export function recordLocalThreat(type: string): void {
  const data = getSecurityData() || { usedNonces: [], localThreats: [] };

  data.localThreats.push({
    type,
    detectedAt: Date.now(),
    reported: false,
  });

  // Keep only last 50 threats
  if (data.localThreats.length > 50) {
    data.localThreats = data.localThreats.slice(-50);
  }

  saveSecurityData(data);
}

/**
 * Get unreported local threats
 */
export function getUnreportedThreats(): Array<{ type: string; detectedAt: number }> {
  const data = getSecurityData();
  if (!data?.localThreats) return [];

  return data.localThreats
    .filter((t) => !t.reported)
    .map(({ type, detectedAt }) => ({ type, detectedAt }));
}

/**
 * Mark threats as reported
 */
export function markThreatsReported(): void {
  const data = getSecurityData();
  if (!data?.localThreats) return;

  data.localThreats = data.localThreats.map((t) => ({ ...t, reported: true }));
  saveSecurityData(data);
}

/**
 * Initialize local security on app load
 */
export async function initializeLocalSecurity(): Promise<{
  signals: DeviceSignals;
  ipInfo: IPInfo | null;
  state: SecurityState;
}> {
  // Collect device signals
  const signals = await collectDeviceSignals();

  // Save device signals
  const data = getSecurityData() || { usedNonces: [], localThreats: [] };
  data.deviceSignals = signals;
  saveSecurityData(data);

  // Fetch IP info (in background, don't block)
  const ipPromise = fetchAndStoreIP();

  // Run security check
  const state = await runSecurityCheck();

  // Wait for IP (with timeout)
  let ipInfo: IPInfo | null = null;
  try {
    ipInfo = await Promise.race([
      ipPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
  } catch {
    // IP fetch failed
  }

  return { signals, ipInfo, state };
}
