import { hashPin, generateDeviceSalt } from './crypto';

const PIN_STORAGE_KEY = 'tc_pin_hash';
const SALT_STORAGE_KEY = 'tc_pin_salt';
const ATTEMPTS_KEY = 'tc_pin_attempts';
const LOCKOUT_KEY = 'tc_pin_lockout';
const FROZEN_KEY = 'tc_pin_frozen';

const BLOCKED_PINS = [
  '000000', '111111', '222222', '333333', '444444', '555555',
  '666666', '777777', '888888', '999999', '696969', '420420',
  '123456', '654321', '234567', '765432', '012345', '543210'
];

function isSequential(pin: string): boolean {
  const digits = pin.split('').map(Number);
  let ascending = true;
  let descending = true;

  for (let i = 1; i < digits.length; i++) {
    if (digits[i] !== digits[i - 1] + 1) ascending = false;
    if (digits[i] !== digits[i - 1] - 1) descending = false;
  }

  return ascending || descending;
}

function isRepeated(pin: string): boolean {
  return pin.split('').every(d => d === pin[0]);
}

export function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: 'PIN must be exactly 6 digits' };
  }

  if (isSequential(pin)) {
    return { valid: false, error: 'PIN cannot be sequential (like 123456)' };
  }

  if (isRepeated(pin)) {
    return { valid: false, error: 'PIN cannot be all the same digit' };
  }

  if (BLOCKED_PINS.includes(pin)) {
    return { valid: false, error: 'This PIN is too common. Choose another.' };
  }

  return { valid: true };
}

export function savePin(pin: string): void {
  if (typeof window === 'undefined') return;

  let salt = localStorage.getItem(SALT_STORAGE_KEY);
  if (!salt) {
    salt = generateDeviceSalt();
    localStorage.setItem(SALT_STORAGE_KEY, salt);
  }

  const hashed = hashPin(pin, salt);
  localStorage.setItem(PIN_STORAGE_KEY, hashed);
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

export function verifyPin(pin: string): boolean {
  if (typeof window === 'undefined') return false;

  const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
  const salt = localStorage.getItem(SALT_STORAGE_KEY);

  if (!storedHash || !salt) return false;

  const inputHash = hashPin(pin, salt);
  return inputHash === storedHash;
}

export function hasPin(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PIN_STORAGE_KEY) !== null;
}

export function clearPin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(SALT_STORAGE_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
  localStorage.removeItem(FROZEN_KEY);
}

export function recordFailedAttempt(): { locked: boolean; frozen: boolean; lockoutUntil?: number } {
  if (typeof window === 'undefined') return { locked: false, frozen: false };

  const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
  localStorage.setItem(ATTEMPTS_KEY, attempts.toString());

  if (attempts >= 10) {
    localStorage.setItem(FROZEN_KEY, 'true');
    return { locked: true, frozen: true };
  }

  if (attempts >= 3) {
    const lockoutUntil = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString());
    return { locked: true, frozen: false, lockoutUntil };
  }

  return { locked: false, frozen: false };
}

export function clearAttempts(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

export function getLockoutStatus(): { locked: boolean; frozen: boolean; lockoutUntil?: number; attemptsRemaining: number } {
  if (typeof window === 'undefined') {
    return { locked: false, frozen: false, attemptsRemaining: 3 };
  }

  const frozen = localStorage.getItem(FROZEN_KEY) === 'true';
  if (frozen) {
    return { locked: true, frozen: true, attemptsRemaining: 0 };
  }

  const lockoutUntilStr = localStorage.getItem(LOCKOUT_KEY);
  if (lockoutUntilStr) {
    const lockoutUntil = parseInt(lockoutUntilStr, 10);
    if (Date.now() < lockoutUntil) {
      return { locked: true, frozen: false, lockoutUntil, attemptsRemaining: 0 };
    } else {
      localStorage.removeItem(LOCKOUT_KEY);
    }
  }

  const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10);
  return { locked: false, frozen: false, attemptsRemaining: Math.max(0, 3 - attempts) };
}

export function isFrozen(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(FROZEN_KEY) === 'true';
}
