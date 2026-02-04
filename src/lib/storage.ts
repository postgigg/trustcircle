const DEVICE_TOKEN_KEY = 'tc_device_token';
const ZONE_KEY = 'tc_zone';
const STRIPE_CUSTOMER_KEY = 'tc_stripe_customer';
const SUBSCRIPTION_TYPE_KEY = 'tc_subscription_type';
const VERIFICATION_START_KEY = 'tc_verification_start';
const STATUS_KEY = 'tc_status';
const SUBSCRIPTION_STATUS_KEY = 'tc_subscription_status';
const SUBSCRIPTION_STATUS_UPDATED_KEY = 'tc_subscription_status_updated';

import type { Zone, DeviceStatus, SubscriptionType, SubscriptionStatus } from '@/types';

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DEVICE_TOKEN_KEY);
}

export function setDeviceToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

export function getZone(): Zone | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(ZONE_KEY);
  return data ? JSON.parse(data) : null;
}

export function setZone(zone: Zone): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ZONE_KEY, JSON.stringify(zone));
}

export function getStripeCustomerId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STRIPE_CUSTOMER_KEY);
}

export function setStripeCustomerId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STRIPE_CUSTOMER_KEY, id);
}

export function getSubscriptionType(): SubscriptionType | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SUBSCRIPTION_TYPE_KEY) as SubscriptionType | null;
}

export function setSubscriptionType(type: SubscriptionType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUBSCRIPTION_TYPE_KEY, type);
}

export function getVerificationStartDate(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VERIFICATION_START_KEY);
}

export function setVerificationStartDate(date: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VERIFICATION_START_KEY, date);
}

export function getStatus(): DeviceStatus | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STATUS_KEY) as DeviceStatus | null;
}

export function setStatus(status: DeviceStatus): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATUS_KEY, status);
}

export function clearAllStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_TOKEN_KEY);
  localStorage.removeItem(ZONE_KEY);
  localStorage.removeItem(STRIPE_CUSTOMER_KEY);
  localStorage.removeItem(SUBSCRIPTION_TYPE_KEY);
  localStorage.removeItem(VERIFICATION_START_KEY);
  localStorage.removeItem(STATUS_KEY);
  localStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
  localStorage.removeItem(SUBSCRIPTION_STATUS_UPDATED_KEY);
}

export function isRegistered(): boolean {
  return getDeviceToken() !== null;
}

export function getRegistrationData() {
  return {
    deviceToken: getDeviceToken(),
    zone: getZone(),
    stripeCustomerId: getStripeCustomerId(),
    subscriptionType: getSubscriptionType(),
    verificationStartDate: getVerificationStartDate(),
    status: getStatus(),
  };
}

// Subscription status caching
const SUBSCRIPTION_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function getCachedSubscriptionStatus(): SubscriptionStatus | null {
  if (typeof window === 'undefined') return null;

  const cached = localStorage.getItem(SUBSCRIPTION_STATUS_KEY);
  const updatedAt = localStorage.getItem(SUBSCRIPTION_STATUS_UPDATED_KEY);

  if (!cached || !updatedAt) return null;

  const cacheAge = Date.now() - parseInt(updatedAt, 10);
  if (cacheAge > SUBSCRIPTION_CACHE_TTL) return null;

  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function setCachedSubscriptionStatus(status: SubscriptionStatus): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUBSCRIPTION_STATUS_KEY, JSON.stringify(status));
  localStorage.setItem(SUBSCRIPTION_STATUS_UPDATED_KEY, Date.now().toString());
}

export function clearSubscriptionStatusCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SUBSCRIPTION_STATUS_KEY);
  localStorage.removeItem(SUBSCRIPTION_STATUS_UPDATED_KEY);
}

export function isSubscriptionCacheStale(): boolean {
  if (typeof window === 'undefined') return true;

  const updatedAt = localStorage.getItem(SUBSCRIPTION_STATUS_UPDATED_KEY);
  if (!updatedAt) return true;

  const cacheAge = Date.now() - parseInt(updatedAt, 10);
  return cacheAge > SUBSCRIPTION_CACHE_TTL;
}
