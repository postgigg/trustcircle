'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceToken, isRegistered } from '@/lib/storage';
import { QRCodeSVG } from 'qrcode.react';

interface RenewalStatus {
  hasActiveRenewal: boolean;
  requestId?: string;
  vouchCount?: number;
  vouchesNeeded?: number;
  qrCodeData?: string;
  expiresAt?: string;
}

export default function SubsidyRenewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [renewalStatus, setRenewalStatus] = useState<RenewalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRenewalStatus = useCallback(async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) return;

    try {
      const response = await fetch('/api/subsidy/renew', {
        headers: { 'x-device-token': deviceToken },
      });

      if (!response.ok) throw new Error('Failed to fetch renewal status');

      const data = await response.json();
      setRenewalStatus(data);

      // If renewal is complete, redirect to badge
      if (data.vouchCount >= 10) {
        router.push('/badge');
      }
    } catch {
      setError('Failed to load renewal status');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isRegistered()) {
      router.push('/');
      return;
    }

    fetchRenewalStatus();
    const interval = setInterval(fetchRenewalStatus, 10000);

    return () => clearInterval(interval);
  }, [router, fetchRenewalStatus]);

  const handleStartRenewal = async () => {
    setStarting(true);
    setError(null);

    const deviceToken = getDeviceToken();
    if (!deviceToken) {
      setError('Not logged in');
      setStarting(false);
      return;
    }

    try {
      const response = await fetch('/api/subsidy/renew', {
        method: 'POST',
        headers: { 'x-device-token': deviceToken },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start renewal');
      }

      const data = await response.json();
      setRenewalStatus({
        hasActiveRenewal: true,
        requestId: data.requestId,
        vouchCount: data.vouchCount,
        vouchesNeeded: 10 - data.vouchCount,
        qrCodeData: data.qrCodeData,
        expiresAt: data.expiresAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start renewal');
    } finally {
      setStarting(false);
    }
  };

  const handleSubscribe = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Loading...</p>
        </div>
      </div>
    );
  }

  const vouchCount = renewalStatus?.vouchCount || 0;
  const vouchesNeeded = 10 - vouchCount;
  const progress = (vouchCount / 10) * 100;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
            </div>
            <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
          <button
            onClick={() => router.back()}
            className="text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-6">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Renew Sponsorship</h1>
          <p className="text-neutral-500">
            Collect 10 vouches from verified neighbors to renew your free access for another year.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {!renewalStatus?.hasActiveRenewal ? (
          /* Start renewal flow */
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-neutral-900 mb-2">Your Sponsorship Expired</h2>
              <p className="text-neutral-500 text-sm">
                Start the renewal process to collect vouches from your neighbors.
              </p>
            </div>

            <button
              onClick={handleStartRenewal}
              disabled={starting}
              className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-semibold text-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {starting ? 'Starting...' : 'Start Renewal Process'}
            </button>

            <div className="mt-4 pt-4 border-t border-neutral-200">
              <p className="text-center text-sm text-neutral-500 mb-3">Or subscribe instead</p>
              <button
                onClick={handleSubscribe}
                className="w-full py-3 bg-neutral-100 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-200 transition-colors"
              >
                Subscribe $0.99/month
              </button>
            </div>
          </div>
        ) : (
          /* Active renewal - show QR and progress */
          <div className="space-y-6">
            {/* Progress Card */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-neutral-900">Vouches Collected</h2>
                <span className="text-2xl font-bold text-neutral-900">{vouchCount}/10</span>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-neutral-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-sm text-neutral-500">
                {vouchesNeeded > 0
                  ? `${vouchesNeeded} more ${vouchesNeeded === 1 ? 'vouch' : 'vouches'} needed`
                  : 'Renewal complete!'}
              </p>
            </div>

            {/* QR Code Card */}
            {vouchesNeeded > 0 && renewalStatus.qrCodeData && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h2 className="font-bold text-neutral-900 mb-4 text-center">Share This QR Code</h2>

                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-white rounded-xl border border-neutral-200">
                    <QRCodeSVG
                      value={renewalStatus.qrCodeData}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>

                <p className="text-sm text-neutral-500 text-center">
                  Ask verified neighbors to scan this code with their TrustCircle app to vouch for you.
                </p>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-neutral-100 rounded-xl p-4">
              <h3 className="font-semibold text-neutral-900 mb-3">How to collect vouches:</h3>
              <ol className="space-y-3 text-sm text-neutral-600">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <span>Show this QR code to a verified TrustCircle neighbor</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <span>They scan the code using their app&apos;s Verify tab</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <span>Repeat with 10 different neighbors to renew</span>
                </li>
              </ol>
            </div>

            {/* Expiry notice */}
            {renewalStatus.expiresAt && (
              <p className="text-xs text-neutral-400 text-center">
                This renewal request expires on {new Date(renewalStatus.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
