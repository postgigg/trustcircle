'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Zone, DeviceStatus } from '@/types';
import { getDeviceToken, getZone, getStatus, isRegistered } from '@/lib/storage';
import { hasPin, verifyPin, getLockoutStatus, recordFailedAttempt, clearAttempts, isFrozen } from '@/lib/pin';
import { detectScreenMirroring } from '@/lib/device-fingerprint';
import BadgeRenderer from '@/components/BadgeRenderer';
import PinInput from '@/components/PinInput';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/ui/BottomNav';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function BadgePageContent() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [zone, setZone] = useState<Zone | null>(null);
  const [seed, setSeed] = useState<string>('');
  const [status, setStatus] = useState<DeviceStatus>('verifying');
  const [isSubsidized, setIsSubsidized] = useState(false);
  const [microVariation, setMicroVariation] = useState(0);
  const [pinError, setPinError] = useState<string | undefined>();
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMirroring, setIsMirroring] = useState(false);

  const fetchBadgeData = useCallback(async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) return;

    try {
      const response = await fetch('/api/badge/seed', {
        headers: { 'x-device-token': deviceToken },
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.status === 'revoked' || data.status === 'frozen') {
          setStatus(data.status);
        }
        return;
      }

      const data = await response.json();
      setZone(data.zone);
      setSeed(data.seed);
      setStatus(data.status);
      setIsSubsidized(data.isSubsidized);
      setMicroVariation(data.params.microVariation);

      if (data.status === 'verifying') {
        router.push('/verifying');
      }
    } catch (error) {
      console.error('Failed to fetch badge data:', error);
    }
  }, [router]);

  useEffect(() => {
    if (!isRegistered()) {
      router.push('/');
      return;
    }

    if (!hasPin()) {
      router.push('/pin-setup');
      return;
    }

    const lockout = getLockoutStatus();
    if (lockout.frozen) {
      setStatus('frozen');
      setLoading(false);
      return;
    }

    if (lockout.locked && lockout.lockoutUntil) {
      setLockoutTime(lockout.lockoutUntil);
    }

    const storedZone = getZone();
    const storedStatus = getStatus();
    if (storedZone) setZone(storedZone);
    if (storedStatus) setStatus(storedStatus);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!authenticated) return;

    fetchBadgeData();
    const interval = setInterval(fetchBadgeData, 30000);

    return () => clearInterval(interval);
  }, [authenticated, fetchBadgeData]);

  useEffect(() => {
    if (!authenticated) return;

    const checkMirroring = () => {
      setIsMirroring(detectScreenMirroring());
    };

    checkMirroring();
    const interval = setInterval(checkMirroring, 1000);
    document.addEventListener('visibilitychange', checkMirroring);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkMirroring);
    };
  }, [authenticated]);

  useEffect(() => {
    if (!lockoutTime) return;

    const interval = setInterval(() => {
      if (Date.now() >= lockoutTime) {
        setLockoutTime(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTime]);

  const handlePinComplete = (pin: string) => {
    if (verifyPin(pin)) {
      clearAttempts();
      setAuthenticated(true);
      setPinError(undefined);
    } else {
      const result = recordFailedAttempt();
      if (result.frozen) {
        setStatus('frozen');
      } else if (result.locked && result.lockoutUntil) {
        setLockoutTime(result.lockoutUntil);
        setPinError('Too many attempts. Try again in 5 minutes.');
      } else {
        setPinError('Incorrect PIN');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="md" />
          <p className="text-neutral-500 text-sm tracking-wide">Loading badge...</p>
        </div>
      </div>
    );
  }

  if (isFrozen() || status === 'frozen') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Badge Frozen</h1>
          <p className="text-neutral-500 mt-3">Too many failed PIN attempts. Your badge has been frozen for security.</p>
          <a
            href="mailto:support@trustcircle.app"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    const remainingTime = lockoutTime ? Math.ceil((lockoutTime - Date.now()) / 1000) : 0;
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    if (lockoutTime && Date.now() < lockoutTime) {
      return (
        <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Temporarily Locked</h2>
            <p className="text-neutral-500 mt-2">Too many incorrect attempts. Try again in</p>
            <p className="text-4xl font-bold text-red-500 mt-3 font-mono">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-neutral-900">Unlock Your Badge</h2>
            <p className="text-neutral-500 mt-1">Enter your 6-digit PIN</p>
          </div>
          <PinInput
            onComplete={handlePinComplete}
            error={pinError}
          />
        </div>
      </div>
    );
  }

  if (isMirroring) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Screen Sharing Detected</h2>
        <p className="text-white/60 mt-3 text-center max-w-xs">Badge hidden for security. Return to this app directly.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col pb-20">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
            </div>
            <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">Verified</span>
          </div>
        </div>
      </header>

      {/* Badge Display */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {zone && seed && (
          <BadgeRenderer
            zone={zone}
            seed={seed}
            status={status}
            isSubsidized={isSubsidized}
            microVariation={microVariation}
          />
        )}

        {/* Lock indicator */}
        <div className="mt-6 flex items-center gap-2 text-neutral-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm">PIN protected</span>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function BadgePage() {
  return (
    <ProtectedRoute>
      <BadgePageContent />
    </ProtectedRoute>
  );
}
