'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setDeviceToken, setZone, setStripeCustomerId, setSubscriptionType, setVerificationStartDate, setStatus } from '@/lib/storage';

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      const zoneId = searchParams.get('zone_id');
      const fingerprint = searchParams.get('fingerprint');

      if (!sessionId || !zoneId) {
        setError('Missing checkout information. Please try again.');
        setLoading(false);
        return;
      }

      try {
        const zoneResponse = await fetch(`/api/zone/${zoneId}/preview`);
        const zoneData = await zoneResponse.json();

        if (zoneData.error) {
          setError('Failed to load zone information.');
          setLoading(false);
          return;
        }

        const deviceToken = generateTempToken(fingerprint || 'unknown', sessionId);

        setDeviceToken(deviceToken);
        setZone(zoneData);
        setSubscriptionType('paid');
        setVerificationStartDate(new Date().toISOString().split('T')[0]);
        setStatus('verifying');

        router.push('/pin-setup');
      } catch {
        setError('Failed to complete registration. Please try again.');
        setLoading(false);
      }
    };

    processCheckout();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B365D] to-[#0d1b2e] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#E74C3C]/10 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-[#E74C3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#2C3E50]">Something went wrong</h1>
          <p className="text-[#7F8C8D] mt-2">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full mt-6 py-4 bg-[#1B365D] text-white rounded-xl font-bold hover:bg-[#152a4a] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1B365D] to-[#0d1b2e] flex flex-col items-center justify-center p-6">
        <div className="text-center">
          {/* Animated Logo */}
          <div className="relative w-32 h-32 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#2ECC71]/30 to-[#2ECC71]/10 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#2ECC71]/40 to-[#2ECC71]/20 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="absolute inset-8 rounded-full bg-[#2ECC71]/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white">Welcome to TrustCircle!</h1>
          <p className="text-white/70 mt-3 text-lg">Your payment was successful</p>

          {/* Loading Indicator */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white/60">Setting up your account...</span>
          </div>

          {/* Progress Steps */}
          <div className="mt-12 space-y-4 max-w-xs mx-auto">
            <div className="flex items-center gap-3 text-white/80">
              <div className="w-6 h-6 rounded-full bg-[#2ECC71] flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Payment confirmed</span>
            </div>
            <div className="flex items-center gap-3 text-white/80">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <span>Creating your secure profile</span>
            </div>
            <div className="flex items-center gap-3 text-white/40">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/40" />
              </div>
              <span>Set up your PIN</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function generateTempToken(fingerprint: string, sessionId: string): string {
  const combined = `${fingerprint}:${sessionId}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-[#1B365D] to-[#0d1b2e] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-[#4A90D9]/30" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-[#4A90D9] animate-spin" />
        </div>
      </div>
    }>
      <WelcomeContent />
    </Suspense>
  );
}
