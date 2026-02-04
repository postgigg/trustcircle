const MOVEMENT_LOG_KEY = 'tc_movement_log';
const MOVEMENT_SAMPLES_KEY = 'tc_movement_samples';

interface MovementSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

interface DayMovement {
  date: string;
  detected: boolean;
  windows: number[];
}

function getCurrentWindow(): number {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 0;
  if (hour >= 10 && hour < 14) return 1;
  if (hour >= 14 && hour < 18) return 2;
  if (hour >= 18 && hour < 22) return 3;
  return -1;
}

export function startMovementSampling(duration: number = 30000): Promise<MovementSample[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.DeviceMotionEvent) {
      resolve([]);
      return;
    }

    const samples: MovementSample[] = [];
    const startTime = Date.now();

    const handler = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        samples.push({
          timestamp: Date.now(),
          x: acc.x,
          y: acc.y,
          z: acc.z,
        });
      }
    };

    window.addEventListener('devicemotion', handler);

    setTimeout(() => {
      window.removeEventListener('devicemotion', handler);
      resolve(samples);
    }, duration);
  });
}

export function analyzeMovementPattern(samples: MovementSample[]): {
  isHuman: boolean;
  isStationary: boolean;
  isEnvironmental: boolean;
} {
  if (samples.length < 10) {
    return { isHuman: false, isStationary: true, isEnvironmental: false };
  }

  const accelerations: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    const dz = samples[i].z - samples[i - 1].z;
    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
    accelerations.push(magnitude);
  }

  const mean = accelerations.reduce((a, b) => a + b, 0) / accelerations.length;
  const variance = accelerations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / accelerations.length;
  const stdDev = Math.sqrt(variance);

  const isStationary = mean < 0.1 && stdDev < 0.05;

  if (isStationary) {
    return { isHuman: false, isStationary: true, isEnvironmental: false };
  }

  const isEnvironmental = stdDev < 0.2 && mean < 0.5;

  if (isEnvironmental) {
    return { isHuman: false, isStationary: false, isEnvironmental: true };
  }

  const irregularity = stdDev / mean;
  const hasRotation = samples.some((s, i) => {
    if (i === 0) return false;
    const angleDiff = Math.abs(Math.atan2(s.y, s.x) - Math.atan2(samples[i - 1].y, samples[i - 1].x));
    return angleDiff > 0.1;
  });

  const isHuman = irregularity > 0.3 && hasRotation && mean > 0.2;

  return { isHuman, isStationary: false, isEnvironmental: false };
}

export function recordMovement(detected: boolean): void {
  if (typeof globalThis.window === 'undefined') return;

  const today = new Date().toISOString().split('T')[0];
  const timeWindow = getCurrentWindow();

  if (timeWindow === -1) return;

  const logStr = localStorage.getItem(MOVEMENT_LOG_KEY);
  const log: DayMovement[] = logStr ? JSON.parse(logStr) : [];

  let entry = log.find(m => m.date === today);
  if (!entry) {
    entry = { date: today, detected: false, windows: [] };
    log.push(entry);
  }

  if (detected && !entry.windows.includes(timeWindow)) {
    entry.windows.push(timeWindow);
  }

  entry.detected = entry.windows.length >= 2;

  localStorage.setItem(MOVEMENT_LOG_KEY, JSON.stringify(log));
}

export function getMovementLog(): DayMovement[] {
  if (typeof window === 'undefined') return [];
  const logStr = localStorage.getItem(MOVEMENT_LOG_KEY);
  return logStr ? JSON.parse(logStr) : [];
}

export function getMovementDaysCount(): number {
  const log = getMovementLog();
  return log.filter(m => m.detected).length;
}

export function clearMovementLog(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MOVEMENT_LOG_KEY);
  localStorage.removeItem(MOVEMENT_SAMPLES_KEY);
}

export function getConsecutiveNoMovementDays(): number {
  const log = getMovementLog();
  if (log.length === 0) return 0;

  const sorted = [...log].sort((a, b) => b.date.localeCompare(a.date));
  let count = 0;

  for (const entry of sorted) {
    if (!entry.detected) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

export async function checkAndRecordMovement(): Promise<boolean> {
  const samples = await startMovementSampling(5000);
  const analysis = analyzeMovementPattern(samples);
  recordMovement(analysis.isHuman);
  return analysis.isHuman;
}
