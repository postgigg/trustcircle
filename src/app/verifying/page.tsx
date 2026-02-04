'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getDeviceToken, getZone, getVerificationStartDate, isRegistered } from '@/lib/storage';
import { hasPin } from '@/lib/pin';
import { collectPresenceData, isNighttime } from '@/lib/presence';
import { checkAndRecordMovement, getMovementDaysCount } from '@/lib/movement';
import BottomNav from '@/components/ui/BottomNav';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { HelpTooltip } from '@/components/ui/Tooltip';
import type { Zone } from '@/types';

export default function VerifyingPage() {
  const router = useRouter();
  const [nightsConfirmed, setNightsConfirmed] = useState(0);
  const [movementDaysConfirmed, setMovementDaysConfirmed] = useState(0);
  const [verificationStartDate, setVerificationStartDate] = useState<string>('');
  const [zone, setZoneData] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayMovement, setTodayMovement] = useState<boolean | null>(null);

  const checkPresence = useCallback(async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) return;

    if (!isNighttime()) return;

    const presenceData = await collectPresenceData();
    if (!presenceData) return;

    try {
      const response = await fetch('/api/presence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceToken,
          locationHash: presenceData.locationHash,
          wifiHash: presenceData.wifiHash,
        }),
      });

      const data = await response.json();
      if (data.nightsConfirmed !== undefined) {
        setNightsConfirmed(data.nightsConfirmed);
      }
    } catch (error) {
      console.error('Presence check failed:', error);
    }
  }, []);

  const checkMovement = useCallback(async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) return;

    const isHuman = await checkAndRecordMovement();
    setTodayMovement(isHuman);

    try {
      const response = await fetch('/api/movement/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceToken,
          movementDetected: isHuman,
        }),
      });

      const data = await response.json();
      if (data.movementDaysConfirmed !== undefined) {
        setMovementDaysConfirmed(data.movementDaysConfirmed);
      }
    } catch (error) {
      console.error('Movement check failed:', error);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) return;

    try {
      const response = await fetch('/api/badge/seed', {
        headers: { 'x-device-token': deviceToken },
      });

      const data = await response.json();

      if (data.status === 'active') {
        router.push('/badge');
        return;
      }

      setNightsConfirmed(data.nightsConfirmed || 0);
      setMovementDaysConfirmed(data.movementDaysConfirmed || 0);

      if (data.verificationStartDate) {
        setVerificationStartDate(data.verificationStartDate);
      }

      if (data.zone) {
        setZoneData(data.zone);
      }
    } catch (error) {
      console.error('Status fetch failed:', error);
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

    const zoneData = getZone();
    const startDate = getVerificationStartDate();

    if (zoneData) setZoneData(zoneData);
    if (startDate) setVerificationStartDate(startDate);

    setMovementDaysConfirmed(getMovementDaysCount());

    fetchStatus();
    setLoading(false);
  }, [router, fetchStatus]);

  useEffect(() => {
    const presenceInterval = setInterval(checkPresence, 60 * 60 * 1000);
    const movementInterval = setInterval(checkMovement, 4 * 60 * 60 * 1000);

    checkMovement();

    return () => {
      clearInterval(presenceInterval);
      clearInterval(movementInterval);
    };
  }, [checkPresence, checkMovement]);

  const startDate = verificationStartDate ? new Date(verificationStartDate) : new Date();
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(daysPassed, 14);

  const nightsProgress = (nightsConfirmed / 14) * 100;
  const movementProgress = (movementDaysConfirmed / 10) * 100;
  const overallProgress = ((nightsConfirmed / 14) * 0.6 + (movementDaysConfirmed / 10) * 0.4) * 100;

  // Fast-track pricing: starts at $1500, decreases by $107/day, floor at $50
  const fastTrackBasePrice = 1500;
  const dailyDiscount = 107;
  const fastTrackMinPrice = 50;
  const fastTrackDiscount = (currentDay - 1) * dailyDiscount;
  const fastTrackPrice = Math.max(fastTrackBasePrice - fastTrackDiscount, fastTrackMinPrice);
  const communityShare = Math.round(fastTrackPrice * 0.75);
  const sponsoredResidents = Math.floor(communityShare / 12); // ~$12/year per resident

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="md" />
          <p className="text-neutral-500 text-sm tracking-wide">Loading...</p>
        </div>
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-medium text-amber-700">Verifying</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Proving you belong.
          </h1>
          <p className="mt-3 text-neutral-500 text-lg">
            Just live your life. We&apos;ll confirm the rest.
          </p>
        </div>

        {/* Zone Badge */}
        {zone && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-full shadow-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: zone.color_primary }}
              />
              <span className="text-sm font-medium text-neutral-700">{zone.zone_name}</span>
            </div>
          </div>
        )}

        {/* Main Progress Circle */}
        <div className="flex justify-center mb-10">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              {/* Background circle */}
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#e5e5e5"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#171717"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 80}
                strokeDashoffset={2 * Math.PI * 80 * (1 - overallProgress / 100)}
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-center">
                <span className="text-5xl sm:text-6xl font-bold text-neutral-900">{currentDay}</span>
                <span className="text-2xl text-neutral-400">/14</span>
              </div>
              <span className="text-neutral-500 text-sm font-medium mt-1">days</span>
            </div>
          </div>
        </div>

        {/* Progress Cards */}
        <div className="space-y-4 mb-8">
          {/* Nights Progress */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">Nights at home</p>
                    <p className="text-sm text-neutral-500">Sleep here 14 nights</p>
                  </div>
                  <HelpTooltip
                    content="We check that your phone is in your neighborhood zone during nighttime hours (10 PM - 6 AM). You don't need to be home the entire night."
                    position="bottom"
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-neutral-900">{nightsConfirmed}</span>
                <span className="text-neutral-400">/14</span>
              </div>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${nightsProgress}%` }}
              />
            </div>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-sm transition-all ${
                    i < nightsConfirmed ? 'bg-emerald-500' : 'bg-neutral-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Movement Progress */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">Movement detected</p>
                    <p className="text-sm text-neutral-500">Natural activity on 10 days</p>
                  </div>
                  <HelpTooltip
                    content="We detect natural daily patterns—walking, driving, commuting. This proves you're a real person, not a spoofed location. Just carry your phone and live normally."
                    position="bottom"
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-neutral-900">{movementDaysConfirmed}</span>
                <span className="text-neutral-400">/10</span>
              </div>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${movementProgress}%` }}
              />
            </div>
            <div className="flex gap-1 mt-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-sm transition-all ${
                    i < movementDaysConfirmed ? 'bg-blue-500' : 'bg-neutral-100'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Fast-Track Option */}
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 mb-8 text-white relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>

          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Fast-Track</span>
                  <HelpTooltip
                    content="Fast-track lets you skip the 14-day wait and get verified instantly. 75% of the fee goes to sponsor neighbors who can't afford the monthly cost."
                    position="right"
                  />
                </div>
                <h3 className="text-xl font-bold">Skip the wait</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">${fastTrackPrice}</div>
                {fastTrackPrice < fastTrackBasePrice && (
                  <div className="text-xs text-neutral-400 line-through">${fastTrackBasePrice}</div>
                )}
              </div>
            </div>

            {/* Price countdown */}
            {fastTrackPrice > fastTrackMinPrice && (
              <div className="bg-white/10 rounded-lg px-3 py-2 mb-4 inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">Price drops $107 tomorrow</span>
              </div>
            )}

            {/* Community contribution */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">75% goes to your community</p>
                  <p className="text-sm text-neutral-300">${communityShare} to the community pool</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <span className="text-2xl">🎁</span>
                <span>Funds <strong className="text-white">{sponsoredResidents} neighbor{sponsoredResidents !== 1 ? 's' : ''}</strong> for 12 months of free access</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              className="w-full py-4 bg-white text-neutral-900 font-semibold rounded-full hover:bg-neutral-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Fast-track for ${fastTrackPrice}
            </button>

            <p className="text-center text-xs text-neutral-400 mt-3">
              Get verified instantly. Help your neighbors join.
            </p>
          </div>
        </div>

        {/* Today's Status */}
        {todayMovement !== null && (
          <div className={`p-4 rounded-xl border mb-8 ${
            todayMovement
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                todayMovement ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                {todayMovement ? (
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <p className={`font-medium ${todayMovement ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {todayMovement ? 'Movement detected today' : 'Waiting for movement'}
                </p>
                <p className={`text-sm ${todayMovement ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {todayMovement
                    ? 'Your natural activity has been confirmed'
                    : 'Carry your phone and go about your day'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="p-4 bg-neutral-100 rounded-xl mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-neutral-600 text-sm leading-relaxed">
              Just carry your phone and live your life. We&apos;ll confirm you belong here. Short trips (up to 3 nights away) won&apos;t reset your progress.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="border-t border-neutral-200 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-6">How verification works</p>
          <div className="space-y-4">
            {[
              { icon: '🌙', title: 'Sleep at home', desc: '14 nights with your phone nearby' },
              { icon: '🚶', title: 'Move naturally', desc: 'Walking, driving — normal daily activity' },
              { icon: '✓', title: 'Get verified', desc: 'Your badge activates automatically' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="font-medium text-neutral-900">{item.title}</p>
                  <p className="text-sm text-neutral-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
