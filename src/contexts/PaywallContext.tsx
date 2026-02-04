'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getDeviceToken } from '@/lib/storage';
import type { SubscriptionStatus, PaywallStatus } from '@/types';

interface PaywallContextType {
  subscriptionStatus: SubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
  hasAccess: boolean;
}

const defaultSubscriptionStatus: SubscriptionStatus = {
  hasAccess: false,
  status: 'pending',
  subscriptionType: 'paid',
  expiresAt: null,
  isInGracePeriod: false,
  daysUntilExpiry: null,
  renewalRequired: false,
};

const PaywallContext = createContext<PaywallContextType>({
  subscriptionStatus: null,
  isLoading: true,
  error: null,
  refreshStatus: async () => {},
  hasAccess: false,
});

export function usePaywall() {
  return useContext(PaywallContext);
}

interface PaywallProviderProps {
  children: ReactNode;
}

export function PaywallProvider({ children }: PaywallProviderProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionStatus = useCallback(async () => {
    const deviceToken = getDeviceToken();

    if (!deviceToken) {
      setSubscriptionStatus(defaultSubscriptionStatus);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/subscription/status', {
        headers: { 'x-device-token': deviceToken },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }

      const status: SubscriptionStatus = await response.json();
      setSubscriptionStatus(status);

      // Cache the status locally
      if (typeof window !== 'undefined') {
        localStorage.setItem('tc_subscription_status', JSON.stringify(status));
        localStorage.setItem('tc_subscription_status_updated', Date.now().toString());
      }
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
      setError('Failed to verify subscription');

      // Try to use cached status
      if (typeof window !== 'undefined') {
        const cachedStatus = localStorage.getItem('tc_subscription_status');
        if (cachedStatus) {
          try {
            setSubscriptionStatus(JSON.parse(cachedStatus));
          } catch {
            setSubscriptionStatus(defaultSubscriptionStatus);
          }
        } else {
          setSubscriptionStatus(defaultSubscriptionStatus);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionStatus();

    // Refresh status periodically (every 5 minutes)
    const interval = setInterval(fetchSubscriptionStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchSubscriptionStatus]);

  const hasAccess = subscriptionStatus?.hasAccess ?? false;

  return (
    <PaywallContext.Provider
      value={{
        subscriptionStatus,
        isLoading,
        error,
        refreshStatus: fetchSubscriptionStatus,
        hasAccess,
      }}
    >
      {children}
    </PaywallContext.Provider>
  );
}

export function getCachedSubscriptionStatus(): SubscriptionStatus | null {
  if (typeof window === 'undefined') return null;

  const cached = localStorage.getItem('tc_subscription_status');
  const updatedAt = localStorage.getItem('tc_subscription_status_updated');

  if (!cached || !updatedAt) return null;

  // Consider cache stale after 10 minutes
  const cacheAge = Date.now() - parseInt(updatedAt, 10);
  if (cacheAge > 10 * 60 * 1000) return null;

  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export function clearSubscriptionStatusCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('tc_subscription_status');
  localStorage.removeItem('tc_subscription_status_updated');
}
