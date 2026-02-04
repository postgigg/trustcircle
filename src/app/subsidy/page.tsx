'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateDeviceFingerprint, detectEmulator } from '@/lib/device-fingerprint';
import { setDeviceToken, setZone, setSubscriptionType, setVerificationStartDate, setStatus } from '@/lib/storage';
import { hasPin } from '@/lib/pin';
import SubsidyQR from '@/components/SubsidyQR';

function SubsidyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vouchCount, setVouchCount] = useState(0);
  const [zoneName, setZoneName] = useState<string>('');
  const [zoneId, setZoneId] = useState<string>('');
  const [deviceToken, setDeviceTokenState] = useState<string>('');
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    const initSubsidy = async () => {
      if (detectEmulator()) {
        setError('TrustCircle is not available on emulators or virtual machines.');
        setLoading(false);
        return;
      }

      const zoneId = searchParams.get('zone_id');
      const h3Index = searchParams.get('h3_index');
      const lat = searchParams.get('lat');
      const lon = searchParams.get('lon');

      if (!zoneId && !h3Index) {
        setError('Missing zone information. Please go back and try again.');
        setLoading(false);
        return;
      }

      try {
        let zoneData;

        if (h3Index) {
          // H3-based zone - fetch zone info via detect endpoint
          const zoneResponse = await fetch('/api/zone/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: lat ? parseFloat(lat) : 0,
              lon: lon ? parseFloat(lon) : 0,
            }),
          });
          const detectData = await zoneResponse.json();
          zoneData = detectData.zone;
        } else {
          // Legacy zone - fetch via preview endpoint
          const zoneResponse = await fetch(`/api/zone/${zoneId}/preview`);
          zoneData = await zoneResponse.json();
        }

        if (!zoneData || zoneData.error) {
          setError('Failed to load zone information.');
          setLoading(false);
          return;
        }

        setZoneName(zoneData.zone_name);

        const fingerprint = await generateDeviceFingerprint();

        const response = await fetch('/api/subsidy/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zoneId: zoneId || undefined,
            h3Index: h3Index || undefined,
            lat: lat ? parseFloat(lat) : undefined,
            lon: lon ? parseFloat(lon) : undefined,
            deviceFingerprintHash: fingerprint,
          }),
        });

        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        setVouchCount(data.vouchCount || 0);
        setDeviceTokenState(data.deviceToken);
        setZoneId(zoneData.zone_id);
        setDeviceToken(data.deviceToken);
        setZone(zoneData);
        setSubscriptionType('subsidized');
        setLoading(false);
      } catch {
        setError('Failed to start subsidy request. Please try again.');
        setLoading(false);
      }
    };

    initSubsidy();
  }, [searchParams]);

  useEffect(() => {
    if (!deviceToken) return;

    const checkStatus = async () => {
      try {
        const response = await fetch('/api/subsidy/status', {
          headers: { 'x-device-token': deviceToken },
        });

        const data = await response.json();

        if (data.vouchCount !== undefined) {
          setVouchCount(data.vouchCount);
        }

        if (data.status === 'activated') {
          setIsActivated(true);
          setVerificationStartDate(new Date().toISOString().split('T')[0]);
          setStatus('verifying');
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [deviceToken]);

  useEffect(() => {
    if (isActivated) {
      if (hasPin()) {
        router.push('/verifying');
      } else {
        router.push('/pin-setup');
      }
    }
  }, [isActivated, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Setting up...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">Something went wrong</h2>
          <p className="text-neutral-500 mt-2">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-8 px-8 py-3 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
              </div>
              <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-12">
        <SubsidyQR
          deviceToken={deviceToken}
          zoneId={zoneId}
          vouchCount={vouchCount}
          zoneName={zoneName}
          onVouchSuccess={(newCount, activated) => {
            setVouchCount(newCount);
            if (activated) {
              setIsActivated(true);
              setVerificationStartDate(new Date().toISOString().split('T')[0]);
              setStatus('verifying');
            }
          }}
        />
      </main>
    </div>
  );
}

export default function SubsidyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Loading...</p>
        </div>
      </div>
    }>
      <SubsidyContent />
    </Suspense>
  );
}
