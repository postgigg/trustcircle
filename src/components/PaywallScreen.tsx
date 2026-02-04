'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePaywall } from '@/contexts/PaywallContext';
import { getDeviceToken, getStripeCustomerId } from '@/lib/storage';

export default function PaywallScreen() {
  const router = useRouter();
  const { subscriptionStatus, refreshStatus } = usePaywall();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const deviceToken = getDeviceToken();
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceToken && { 'x-device-token': deviceToken }),
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayment = async () => {
    setLoading(true);
    try {
      const customerId = getStripeCustomerId();
      if (!customerId) {
        alert('No payment method on file. Please subscribe.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/checkout/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenewSponsorship = () => {
    router.push('/subsidy/renew');
  };

  const handleRefresh = async () => {
    setLoading(true);
    await refreshStatus();
    setLoading(false);
  };

  const status = subscriptionStatus?.status || 'pending';
  const isSubsidized = subscriptionStatus?.subscriptionType === 'subsidized';
  const isGracePeriod = subscriptionStatus?.isInGracePeriod;
  const daysUntilExpiry = subscriptionStatus?.daysUntilExpiry;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
            </div>
            <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-sm w-full">
          {/* Status Icon */}
          <div className="text-center mb-8">
            {status === 'grace' ? (
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            ) : status === 'expired' ? (
              <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : status === 'blocked' ? (
              <div className="w-20 h-20 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            ) : (
              <div className="w-20 h-20 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}

            {/* Title and description based on status */}
            {status === 'grace' && (
              <>
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Payment Issue</h1>
                <p className="text-neutral-500">
                  Your payment failed.
                  {daysUntilExpiry && daysUntilExpiry > 0 && (
                    <span className="block mt-1 text-amber-600 font-medium">
                      {daysUntilExpiry} days remaining to update payment
                    </span>
                  )}
                </p>
              </>
            )}

            {status === 'expired' && isSubsidized && (
              <>
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Sponsorship Expired</h1>
                <p className="text-neutral-500">
                  Your community sponsorship has expired after 1 year. Renew by collecting 10 neighbor vouches or subscribe.
                </p>
              </>
            )}

            {status === 'expired' && !isSubsidized && (
              <>
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Subscription Expired</h1>
                <p className="text-neutral-500">
                  Your subscription has ended. Resubscribe to regain access to TrustCircle.
                </p>
              </>
            )}

            {status === 'pending' && (
              <>
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Subscription Required</h1>
                <p className="text-neutral-500">
                  Access TrustCircle for just $0.99/month, or get sponsored by 10 verified neighbors for free.
                </p>
              </>
            )}

            {status === 'blocked' && (
              <>
                <h1 className="text-2xl font-bold text-neutral-900 mb-2">Account Suspended</h1>
                <p className="text-neutral-500">
                  Your account has been suspended. Please contact support for assistance.
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          {status !== 'blocked' && (
            <div className="space-y-3">
              {/* Grace period - show update payment */}
              {status === 'grace' && (
                <button
                  onClick={handleUpdatePayment}
                  disabled={loading}
                  className="w-full py-4 bg-amber-500 text-white rounded-2xl font-semibold text-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Update Payment Method'}
                </button>
              )}

              {/* Expired subsidized - show renew option */}
              {status === 'expired' && isSubsidized && (
                <button
                  onClick={handleRenewSponsorship}
                  disabled={loading}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-semibold text-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Renew Sponsorship (Free)
                </button>
              )}

              {/* Subscribe button - always show except for grace period */}
              {status !== 'grace' && (
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className={`w-full py-4 rounded-2xl font-semibold text-lg transition-colors disabled:opacity-50 ${
                    status === 'expired' && isSubsidized
                      ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {loading ? 'Loading...' : 'Subscribe $0.99/month'}
                </button>
              )}

              {/* Get sponsored option */}
              {status === 'pending' && (
                <button
                  onClick={() => router.push('/sponsored')}
                  disabled={loading}
                  className="w-full py-4 bg-neutral-100 text-neutral-700 rounded-2xl font-semibold text-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
                >
                  Get Sponsored by Neighbors
                </button>
              )}
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-full mt-6 py-3 text-neutral-500 font-medium hover:text-neutral-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Already subscribed? Refresh'}
          </button>

          {/* Info section */}
          <div className="mt-8 p-4 bg-neutral-100 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {isSubsidized
                  ? 'Community sponsorship lasts 1 year. Collect vouches from 10 verified neighbors to renew for free.'
                  : 'Your subscription helps fund community sponsorships for neighbors who need assistance.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
