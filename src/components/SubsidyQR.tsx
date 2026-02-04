'use client';

import { useState } from 'react';
import BadgeScanner from './BadgeScanner';

interface SubsidyQRProps {
  deviceToken: string;
  zoneId: string;
  vouchCount: number;
  zoneName: string;
  onVouchSuccess: (newCount: number, activated: boolean) => void;
}

export default function SubsidyQR({ deviceToken, zoneId, vouchCount, zoneName, onVouchSuccess }: SubsidyQRProps) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  const progress = (vouchCount / 10) * 100;
  const remaining = 10 - vouchCount;

  const handleScanBadge = async (badgeSeed: string) => {
    setScanError(null);
    setScanSuccess(false);

    try {
      const response = await fetch('/api/vouch/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken,
        },
        body: JSON.stringify({
          badgeSeed,
          zoneId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setScanError(data.error);
        return;
      }

      setScanSuccess(true);
      setScanning(false);
      onVouchSuccess(data.vouchCount, data.activated);

      // Clear success message after a moment
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      setScanError('Failed to verify badge. Please try again.');
    }
  };

  return (
    <div className="flex flex-col">
      {/* Scanner Modal */}
      {scanning && (
        <BadgeScanner
          onScanSuccess={handleScanBadge}
          onClose={() => setScanning(false)}
          scanning={scanning}
        />
      )}

      {/* Mobile-First Layout */}
      <div className="lg:hidden">
        {/* Progress Card - Top on Mobile */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-neutral-900">{vouchCount}</span>
              <span className="text-lg text-neutral-400">/10</span>
            </div>
            <span className="text-sm text-neutral-500">vouches collected</span>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-neutral-900 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Vouch Dots - Compact for Mobile */}
          <div className="flex justify-between gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
                  i < vouchCount
                    ? 'bg-emerald-500 text-white'
                    : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {i < vouchCount ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mb-2">
          Get Sponsored Access
        </h1>
        <p className="text-neutral-500 mb-6">
          Scan badges from 10 verified neighbors to join TrustCircle free.
        </p>

        {/* Scan Button - Full Width on Mobile */}
        <button
          onClick={() => setScanning(true)}
          className="w-full bg-neutral-900 text-white py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-lg shadow-neutral-900/20"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4m8-18h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4" />
          </svg>
          <span className="text-base font-semibold">Scan a Badge</span>
        </button>

        {/* Status Messages */}
        {scanError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-sm">{scanError}</p>
          </div>
        )}

        {scanSuccess && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-emerald-700 font-medium">Vouch recorded!</p>
            </div>
          </div>
        )}

        {/* Status Card */}
        {vouchCount >= 10 ? (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-900">You&apos;re in!</p>
                <p className="text-emerald-700 text-sm">Setting up your account...</p>
              </div>
            </div>
          </div>
        ) : vouchCount === 0 ? (
          <div className="mt-4 p-4 bg-neutral-100 rounded-xl">
            <p className="font-medium text-neutral-900">
              Ready to get started
            </p>
            <p className="text-neutral-500 text-sm mt-1">
              Find a neighbor with a TrustCircle badge in {zoneName} and scan it to collect your first sponsorship.
            </p>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-neutral-100 rounded-xl">
            <p className="font-medium text-neutral-900">
              {remaining} more badge{remaining !== 1 ? 's' : ''} needed
            </p>
            <p className="text-neutral-500 text-sm mt-1">
              Keep finding verified residents in {zoneName}
            </p>
          </div>
        )}

        {/* How It Works - Compact for Mobile */}
        <div className="mt-8 pt-6 border-t border-neutral-200">
          <p className="text-xs uppercase tracking-[0.15em] text-neutral-400 mb-4">How it works</p>

          <div className="space-y-4">
            {[
              { step: '1', title: 'Find', desc: 'Find a neighbor with a verified TrustCircle badge' },
              { step: '2', title: 'Scan', desc: 'Scan their badge with your camera' },
              { step: '3', title: 'Join', desc: 'After 10 scans, join TrustCircle free' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <p className="font-medium text-neutral-900 text-sm">{item.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Title Section */}
        <div className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
            Get sponsored access.
          </h1>
          <p className="mt-4 text-xl text-neutral-500 max-w-md">
            Scan the badges of 10 verified neighbors to join TrustCircle for free.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left: Scan Button */}
          <div>
            <button
              onClick={() => setScanning(true)}
              className="w-full sm:w-auto bg-neutral-900 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-neutral-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4m8-18h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4" />
              </svg>
              <span className="text-lg font-semibold">Scan a Neighbor&apos;s Badge</span>
            </button>

            {/* Status Messages */}
            {scanError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 text-sm">{scanError}</p>
              </div>
            )}

            {scanSuccess && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-emerald-700 font-medium">Vouch recorded!</p>
                </div>
              </div>
            )}

            <p className="mt-4 text-sm text-neutral-400">
              Find a neighbor with a TrustCircle badge and scan it
            </p>
          </div>

          {/* Right: Progress */}
          <div>
            {/* Progress Count */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-6xl font-bold text-neutral-900">{vouchCount}</span>
              <span className="text-2xl text-neutral-400">/10</span>
              <span className="text-neutral-500 ml-2">vouches</span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-neutral-200 rounded-full overflow-hidden mb-8">
              <div
                className="h-full bg-neutral-900 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Vouch Dots */}
            <div className="flex gap-2 mb-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    i < vouchCount
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {i < vouchCount ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
              ))}
            </div>

            {/* Status Message */}
            {vouchCount >= 10 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900">You&apos;re in!</p>
                    <p className="text-emerald-700 text-sm">Setting up your account...</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-neutral-100 rounded-xl">
                <p className="font-medium text-neutral-900">
                  {remaining} more badge{remaining !== 1 ? 's' : ''} to scan
                </p>
                <p className="text-neutral-500 text-sm mt-1">
                  Find verified residents in {zoneName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16 pt-12 border-t border-neutral-200">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-8">How it works</p>

          <div className="grid sm:grid-cols-3 gap-8">
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full border border-neutral-300 flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">1</div>
              <div>
                <p className="font-medium text-neutral-900">Find</p>
                <p className="text-sm text-neutral-500 mt-1">Find a neighbor who has a verified TrustCircle badge on their phone</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full border border-neutral-300 flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">2</div>
              <div>
                <p className="font-medium text-neutral-900">Scan</p>
                <p className="text-sm text-neutral-500 mt-1">Scan their live badge to collect a vouch from a verified resident</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full border border-neutral-300 flex items-center justify-center text-xs font-medium text-neutral-600 flex-shrink-0">3</div>
              <div>
                <p className="font-medium text-neutral-900">Join</p>
                <p className="text-sm text-neutral-500 mt-1">Once you&apos;ve scanned 10 badges, you join TrustCircle free</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
