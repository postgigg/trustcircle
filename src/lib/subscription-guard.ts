import { supabase } from './supabase';
import type { SubscriptionStatus, PaywallStatus, SubscriptionType } from '@/types';

const GRACE_PERIOD_DAYS = 7;
const SUBSIDY_DURATION_DAYS = 365;
const EXPIRY_WARNING_DAYS = 30;

interface DeviceWithSubscription {
  device_token: string;
  subscription_type: SubscriptionType;
  paywall_status: PaywallStatus | null;
  subsidy_activated_at: string | null;
  subscription_expires_at: string | null;
  grace_period_until: string | null;
  status: string;
}

export async function verifySubscription(deviceToken: string | null): Promise<SubscriptionStatus> {
  if (!deviceToken) {
    return {
      hasAccess: false,
      status: 'pending',
      subscriptionType: 'paid',
      expiresAt: null,
      isInGracePeriod: false,
      daysUntilExpiry: null,
      renewalRequired: false,
    };
  }

  const { data: device, error } = await supabase
    .from('device_tokens')
    .select('device_token, subscription_type, paywall_status, subsidy_activated_at, subscription_expires_at, grace_period_until, status')
    .eq('device_token', deviceToken)
    .single();

  if (error || !device) {
    return {
      hasAccess: false,
      status: 'pending',
      subscriptionType: 'paid',
      expiresAt: null,
      isInGracePeriod: false,
      daysUntilExpiry: null,
      renewalRequired: false,
    };
  }

  const typedDevice = device as DeviceWithSubscription;
  const now = new Date();

  // Check if device is revoked or frozen
  if (typedDevice.status === 'revoked' || typedDevice.status === 'frozen') {
    return {
      hasAccess: false,
      status: 'blocked',
      subscriptionType: typedDevice.subscription_type,
      expiresAt: null,
      isInGracePeriod: false,
      daysUntilExpiry: null,
      renewalRequired: false,
    };
  }

  // Handle paid subscriptions
  if (typedDevice.subscription_type === 'paid') {
    return handlePaidSubscription(typedDevice, now);
  }

  // Handle subsidized subscriptions
  return handleSubsidizedSubscription(typedDevice, now);
}

function handlePaidSubscription(device: DeviceWithSubscription, now: Date): SubscriptionStatus {
  const paywallStatus = device.paywall_status || 'pending';

  // Check grace period
  if (device.grace_period_until) {
    const gracePeriodEnd = new Date(device.grace_period_until);
    if (now < gracePeriodEnd) {
      const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        hasAccess: true,
        status: 'grace',
        subscriptionType: 'paid',
        expiresAt: device.grace_period_until,
        isInGracePeriod: true,
        daysUntilExpiry: daysRemaining,
        renewalRequired: false,
      };
    }
  }

  // Active paid subscription
  if (paywallStatus === 'active') {
    return {
      hasAccess: true,
      status: 'active',
      subscriptionType: 'paid',
      expiresAt: null,
      isInGracePeriod: false,
      daysUntilExpiry: null,
      renewalRequired: false,
    };
  }

  // Expired or other status (not active, already checked above)
  return {
    hasAccess: false,
    status: paywallStatus,
    subscriptionType: 'paid',
    expiresAt: null,
    isInGracePeriod: false,
    daysUntilExpiry: null,
    renewalRequired: paywallStatus === 'expired',
  };
}

function handleSubsidizedSubscription(device: DeviceWithSubscription, now: Date): SubscriptionStatus {
  // Check if subsidy has been activated
  if (!device.subsidy_activated_at) {
    return {
      hasAccess: false,
      status: 'pending',
      subscriptionType: 'subsidized',
      expiresAt: null,
      isInGracePeriod: false,
      daysUntilExpiry: null,
      renewalRequired: false,
    };
  }

  // Calculate expiry (1 year from activation or use explicit expiry date)
  let expiryDate: Date;
  if (device.subscription_expires_at) {
    expiryDate = new Date(device.subscription_expires_at);
  } else {
    expiryDate = new Date(device.subsidy_activated_at);
    expiryDate.setDate(expiryDate.getDate() + SUBSIDY_DURATION_DAYS);
  }

  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Check if expired
  if (now >= expiryDate) {
    return {
      hasAccess: false,
      status: 'expired',
      subscriptionType: 'subsidized',
      expiresAt: expiryDate.toISOString(),
      isInGracePeriod: false,
      daysUntilExpiry: 0,
      renewalRequired: true,
    };
  }

  // Check if nearing expiry (within warning period)
  const renewalRequired = daysUntilExpiry <= EXPIRY_WARNING_DAYS;

  return {
    hasAccess: true,
    status: 'active',
    subscriptionType: 'subsidized',
    expiresAt: expiryDate.toISOString(),
    isInGracePeriod: false,
    daysUntilExpiry,
    renewalRequired,
  };
}

export interface SubscriptionGuardResult {
  authorized: boolean;
  status: SubscriptionStatus;
  error?: string;
}

export async function requireActiveSubscription(deviceToken: string | null): Promise<SubscriptionGuardResult> {
  const status = await verifySubscription(deviceToken);

  if (status.hasAccess) {
    return {
      authorized: true,
      status,
    };
  }

  let error: string;
  switch (status.status) {
    case 'pending':
      error = 'Subscription required. Please subscribe or get sponsored by neighbors.';
      break;
    case 'grace':
      error = 'Payment failed. Please update your payment method.';
      break;
    case 'expired':
      if (status.subscriptionType === 'subsidized') {
        error = 'Your community sponsorship has expired. Renew by collecting vouches or subscribe.';
      } else {
        error = 'Your subscription has expired. Please resubscribe to continue.';
      }
      break;
    case 'blocked':
      error = 'Your account has been suspended.';
      break;
    default:
      error = 'Subscription required to access this feature.';
  }

  return {
    authorized: false,
    status,
    error,
  };
}

export async function setGracePeriod(customerId: string): Promise<void> {
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

  await supabase
    .from('device_tokens')
    .update({
      paywall_status: 'grace',
      grace_period_until: gracePeriodEnd.toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}

export async function clearGracePeriod(customerId: string): Promise<void> {
  await supabase
    .from('device_tokens')
    .update({
      paywall_status: 'active',
      grace_period_until: null,
    })
    .eq('stripe_customer_id', customerId);
}

export async function activateSubsidy(deviceToken: string): Promise<void> {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SUBSIDY_DURATION_DAYS);

  await supabase
    .from('device_tokens')
    .update({
      subsidy_activated_at: now.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      paywall_status: 'active',
    })
    .eq('device_token', deviceToken);
}

export async function expireSubscription(customerId: string): Promise<void> {
  await supabase
    .from('device_tokens')
    .update({
      paywall_status: 'expired',
      grace_period_until: null,
    })
    .eq('stripe_customer_id', customerId);
}
