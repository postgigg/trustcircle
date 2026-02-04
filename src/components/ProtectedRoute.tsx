'use client';

import { ReactNode } from 'react';
import { usePaywall } from '@/contexts/PaywallContext';
import PaywallScreen from './PaywallScreen';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { subscriptionStatus, isLoading, hasAccess } = usePaywall();

  // Show loading state
  if (isLoading) {
    return fallback || (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Verifying subscription...</p>
        </div>
      </div>
    );
  }

  // Show paywall if no access
  if (!hasAccess) {
    return <PaywallScreen />;
  }

  // Show expiry warning banner if renewal required
  const showWarning = subscriptionStatus?.renewalRequired && subscriptionStatus?.daysUntilExpiry;

  return (
    <>
      {showWarning && (
        <ExpiryWarningBanner
          daysUntilExpiry={subscriptionStatus.daysUntilExpiry!}
          isSubsidized={subscriptionStatus.subscriptionType === 'subsidized'}
        />
      )}
      {children}
    </>
  );
}

interface ExpiryWarningBannerProps {
  daysUntilExpiry: number;
  isSubsidized: boolean;
}

function ExpiryWarningBanner({ daysUntilExpiry, isSubsidized }: ExpiryWarningBannerProps) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-amber-800">
          {isSubsidized ? (
            <>
              <span className="font-semibold">Sponsorship expires in {daysUntilExpiry} days.</span>
              {' '}
              <a href="/subsidy/renew" className="underline">Renew now</a>
            </>
          ) : (
            <>
              <span className="font-semibold">Subscription expires in {daysUntilExpiry} days.</span>
              {' '}
              <a href="/settings" className="underline">Update payment</a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
