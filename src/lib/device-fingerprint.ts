import { sha256 } from './crypto';

interface FingerprintComponents {
  canvas: string;
  webgl: string;
  screen: string;
  timezone: string;
  language: string;
  audio: string;
  fonts: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  platform: string;
}

async function getCanvasFingerprint(): Promise<string> {
  if (typeof document === 'undefined') return 'server';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'no-canvas';

  canvas.width = 200;
  canvas.height = 50;

  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('TrustCircle', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('fingerprint', 4, 17);

  return canvas.toDataURL();
}

function getWebGLFingerprint(): string {
  if (typeof document === 'undefined') return 'server';

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl || !(gl instanceof WebGLRenderingContext)) return 'no-webgl';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return 'no-debug-info';

  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  return `${vendor}~${renderer}`;
}

function getScreenFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  return `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.devicePixelRatio}`;
}

function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'unknown';
  }
}

function getLanguage(): string {
  if (typeof navigator === 'undefined') return 'server';
  return navigator.language || 'unknown';
}

async function getAudioFingerprint(): Promise<string> {
  if (typeof window === 'undefined' || !window.AudioContext) return 'no-audio';

  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gain = audioContext.createGain();
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
    gain.gain.setValueAtTime(0, audioContext.currentTime);

    oscillator.connect(analyser);
    analyser.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);

    return new Promise((resolve) => {
      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += Math.abs(data[i]);
        }
        oscillator.disconnect();
        processor.disconnect();
        audioContext.close();
        resolve(sum.toString());
      };
      oscillator.start(0);
      setTimeout(() => {
        oscillator.stop();
      }, 100);
    });
  } catch {
    return 'audio-error';
  }
}

function getFontsFingerprint(): string {
  if (typeof document === 'undefined') return 'server';

  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
    'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Helvetica',
    'Palatino', 'Garamond', 'Bookman', 'Avant Garde', 'Geneva'
  ];

  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  const span = document.createElement('span');
  span.style.position = 'absolute';
  span.style.left = '-9999px';
  span.style.fontSize = testSize;
  span.innerHTML = testString;

  const body = document.body;
  const defaultWidths: { [key: string]: number } = {};

  for (const baseFont of baseFonts) {
    span.style.fontFamily = baseFont;
    body.appendChild(span);
    defaultWidths[baseFont] = span.offsetWidth;
    body.removeChild(span);
  }

  const detected: string[] = [];
  for (const font of testFonts) {
    for (const baseFont of baseFonts) {
      span.style.fontFamily = `'${font}', ${baseFont}`;
      body.appendChild(span);
      const width = span.offsetWidth;
      body.removeChild(span);
      if (width !== defaultWidths[baseFont]) {
        detected.push(font);
        break;
      }
    }
  }

  return detected.join(',');
}

function getHardwareConcurrency(): number {
  if (typeof navigator === 'undefined') return 0;
  return navigator.hardwareConcurrency || 0;
}

function getDeviceMemory(): number {
  if (typeof navigator === 'undefined') return 0;
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0;
}

function getPlatform(): string {
  if (typeof navigator === 'undefined') return 'server';
  return navigator.platform || 'unknown';
}

export async function generateDeviceFingerprint(): Promise<string> {
  const components: FingerprintComponents = {
    canvas: await getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    screen: getScreenFingerprint(),
    timezone: getTimezone(),
    language: getLanguage(),
    audio: await getAudioFingerprint(),
    fonts: getFontsFingerprint(),
    hardwareConcurrency: getHardwareConcurrency(),
    deviceMemory: getDeviceMemory(),
    platform: getPlatform(),
  };

  const combined = Object.values(components).join('|');
  return sha256(combined);
}

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

  const webglRenderer = getWebGLFingerprint().toLowerCase();
  const vmIndicators = ['swiftshader', 'llvmpipe', 'virtualbox', 'vmware'];
  for (const indicator of vmIndicators) {
    if (webglRenderer.includes(indicator)) return true;
  }

  return false;
}

export function detectScreenMirroring(): boolean {
  if (typeof document === 'undefined') return false;

  if (document.pictureInPictureElement) return true;
  if (document.visibilityState === 'hidden') return true;

  return false;
}

/**
 * Detect headless browser
 */
export function detectHeadlessBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for headless indicators
  const indicators = [
    // Chrome headless
    navigator.webdriver === true,
    // Missing plugins (but not iOS Safari which has no plugins)
    navigator.plugins?.length === 0 && !/iPhone|iPad/i.test(navigator.userAgent),
    // Missing languages
    !navigator.languages || navigator.languages.length === 0,
    // Phantom indicators
    (window as unknown as Record<string, unknown>)['_phantom'] !== undefined,
    (window as unknown as Record<string, unknown>)['__nightmare'] !== undefined,
  ];

  // Check user agent for headless
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('headless')) return true;

  // Return true if 2+ indicators present
  return indicators.filter(Boolean).length >= 2;
}

/**
 * Detect WebDriver / automation
 */
export function detectWebDriver(): boolean {
  if (typeof window === 'undefined') return false;

  // Direct webdriver check
  if (navigator.webdriver === true) return true;

  // Check document attribute
  const docElement = document.documentElement;
  if (docElement.getAttribute('webdriver') !== null) return true;

  return false;
}

/**
 * Detect automation tools (Selenium, Puppeteer, etc.)
 */
export function detectAutomation(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for webdriver first
  if (detectWebDriver()) return true;

  // Check for automation globals
  const automationGlobals = [
    '__webdriver_script_fn',
    '__driver_evaluate',
    '__webdriver_evaluate',
    '__selenium_evaluate',
    '__fxdriver_evaluate',
    '_selenium',
    'calledSelenium',
    '_Selenium_IDE_Recorder',
    '__webdriverFunc',
    '$cdc_asdjflasutopfhvcZLmcfl_', // Chrome DevTools Protocol
    '$chrome_asyncScriptInfo',
  ];

  const win = window as unknown as Record<string, unknown>;
  for (const global of automationGlobals) {
    if (win[global] !== undefined) {
      return true;
    }
  }

  return false;
}

/**
 * Get extended device info for local storage (not sent to server)
 */
export function getExtendedDeviceInfo(): {
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  platform: string;
  screenInfo: string;
  timezone: string;
  language: string;
} {
  return {
    hardwareConcurrency: getHardwareConcurrency(),
    deviceMemory: getDeviceMemory(),
    maxTouchPoints: navigator.maxTouchPoints || 0,
    platform: getPlatform(),
    screenInfo: getScreenFingerprint(),
    timezone: getTimezone(),
    language: getLanguage(),
  };
}
