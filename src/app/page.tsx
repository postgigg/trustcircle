'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Zone } from '@/types';
import { generateDeviceFingerprint, detectEmulator } from '@/lib/device-fingerprint';
import { isRegistered } from '@/lib/storage';
import BadgeRenderer from '@/components/BadgeRenderer';
import DemoBadge from '@/components/DemoBadge';

export default function Home() {
  const router = useRouter();
  const [zone, setZone] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'denied' | 'granted' | 'unknown'>('unknown');

  useEffect(() => {
    if (isRegistered()) {
      router.push('/badge');
      return;
    }
    // Don't request location automatically - show landing page first
    // User will click "Start Verification" to trigger location request
    setLoading(false);
  }, [router]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkLocationPermission = async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionState(result.state as 'prompt' | 'denied' | 'granted');

        if (result.state === 'granted') {
          detectZone();
        } else if (result.state === 'prompt') {
          setShowLocationDialog(true);
          setLoading(false);
        } else if (result.state === 'denied') {
          setShowLocationDialog(true);
          setLoading(false);
        }

        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionState(result.state as 'prompt' | 'denied' | 'granted');
          if (result.state === 'granted') {
            setShowLocationDialog(false);
            detectZone();
          }
        });
      } catch {
        // Fallback for browsers that don't support permissions API
        detectZone();
      }
    } else {
      // Fallback for browsers without permissions API
      detectZone();
    }
  };

  const detectZone = async () => {
    setLoading(true);
    setError(null);
    setShowLocationDialog(false);

    if (detectEmulator()) {
      setError('Not available on emulators.');
      setLoading(false);
      return;
    }

    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            setCoords({ lat, lon });
            setPermissionState('granted');
            const response = await fetch('/api/zone/detect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lat, lon }),
            });
            const data = await response.json();
            if (data.zone) {
              setZone(data.zone);
            } else {
              setError("TrustCircle isn't available in your area yet. We're expanding soon!");
            }
            setLoading(false);
          },
          (err) => {
            setLoading(false);
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionState('denied');
              setShowLocationDialog(true);
            } else {
              setError('Location access blocked. Please enable location in your browser settings and try again.');
            }
          }
        );
      } else {
        setError('Geolocation not supported.');
        setLoading(false);
      }
    } catch {
      setError('Failed to detect location.');
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!zone) return;
    setJoining(true);
    try {
      const fingerprint = await generateDeviceFingerprint();
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: zone.h3_index ? undefined : zone.zone_id,
          h3Index: zone.h3_index,
          lat: coords?.lat,
          lon: coords?.lon,
          deviceFingerprintHash: fingerprint,
        }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setJoining(false);
        return;
      }
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    } catch {
      setError('Failed to start. Try again.');
      setJoining(false);
    }
  };

  const handleSubsidy = () => {
    if (!zone) return;
    const params = new URLSearchParams();
    if (zone.h3_index) {
      params.set('h3_index', zone.h3_index);
      if (coords) {
        params.set('lat', coords.lat.toString());
        params.set('lon', coords.lon.toString());
      }
    } else {
      params.set('zone_id', zone.zone_id);
    }
    router.push(`/subsidy?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Finding your neighborhood...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
            </div>
            <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
          <button
            onClick={() => router.push('/verify')}
            className="text-xs sm:text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Verify someone
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {showLocationDialog ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
              {/* Location Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                {permissionState === 'denied' ? 'Location Access Blocked' : 'Enable Location'}
              </h2>

              <p className="text-neutral-500 mb-4">
                {permissionState === 'denied'
                  ? 'TrustCircle needs your location to verify you live in this neighborhood. Location is blocked in your browser settings.'
                  : 'TrustCircle helps neighbors verify each other and stay safe. We need your location to find your neighborhood.'}
              </p>

              {permissionState !== 'denied' && (
                <div className="flex items-center justify-center gap-4 mb-6 text-xs text-neutral-400">
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>No exact location stored</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Privacy-first</span>
                  </div>
                </div>
              )}

              {permissionState === 'denied' ? (
                <>
                  {/* Instructions for enabling location */}
                  <div className="bg-neutral-100 rounded-2xl p-4 mb-6 text-left">
                    <p className="text-sm font-medium text-neutral-700 mb-3">To enable location access:</p>
                    <ol className="text-sm text-neutral-600 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
                        <span>Click the <strong>lock icon</strong> or <strong>settings icon</strong> in your browser&apos;s address bar</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
                        <span>Find <strong>Location</strong> in the permissions list</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
                        <span>Change from <strong>Block</strong> to <strong>Allow</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">4</span>
                        <span>Refresh this page</span>
                      </li>
                    </ol>
                  </div>

                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 transition-colors"
                  >
                    Refresh Page
                  </button>
                </>
              ) : (
                <>
                  {/* Privacy assurance */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-emerald-900">Your privacy is protected</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          We never store your exact location. Only a neighborhood-level zone is saved.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={detectZone}
                    className="w-full px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    Enable Location Access
                  </button>
                </>
              )}

              <p className="text-xs text-neutral-400 mt-4">
                Location is required to verify neighborhood residence
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-neutral-600 mb-6">{error}</p>
              <button
                onClick={detectZone}
                className="px-6 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section - Landing Page (no location required) */}
            <section className="relative overflow-hidden">
              {/* Background gradient */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  background: zone
                    ? `radial-gradient(ellipse 80% 50% at 50% -20%, ${zone.color_primary}, transparent)`
                    : 'radial-gradient(ellipse 80% 50% at 50% -20%, #3b82f6, transparent)',
                }}
              />

              <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8 sm:py-16 lg:py-20">
                {/* Mobile Layout */}
                <div className="lg:hidden">
                  {/* Zone badge - show if detected */}
                  {zone && (
                    <div className="flex justify-center mb-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur border border-neutral-200 rounded-full">
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: zone.color_primary }}
                        />
                        <span className="text-xs font-medium text-neutral-600">{zone.zone_name}</span>
                      </div>
                    </div>
                  )}

                  {/* Headline */}
                  <h1 className="text-[2.5rem] leading-[1.05] font-bold text-neutral-900 tracking-tight text-center mb-3">
                    You belong<br />here.
                  </h1>

                  <p className="text-base text-neutral-500 text-center mb-6 px-2">
                    The privacy-first way to prove neighborhood residence
                  </p>

                  {/* Badge Preview - Phone Display Mockup */}
                  {zone ? (
                    <div className="relative flex justify-center mb-8">
                      <div className="relative">
                        {/* Ambient glow */}
                        <div
                          className="absolute inset-0 -m-8 rounded-full opacity-30 blur-3xl"
                          style={{
                            background: `radial-gradient(ellipse at center, ${zone.color_primary}50 0%, transparent 70%)`,
                          }}
                        />

                        {/* iPhone 15 Pro: 146.6 x 70.6mm = 2.077:1 - using 150w x 312h */}
                        <div className="relative" style={{ width: '150px', height: '312px' }}>
                          {/* Titanium frame */}
                          <div className="absolute inset-0 bg-[#1a1a1a] rounded-[32px] shadow-2xl" />
                          {/* Inner bezel */}
                          <div className="absolute inset-[2px] bg-black rounded-[30px]" />
                          {/* Screen */}
                          <div className="absolute inset-[4px] bg-[#fafaf9] rounded-[28px] overflow-hidden flex flex-col">
                            {/* Dynamic island */}
                            <div className="flex justify-center pt-2.5">
                              <div className="w-[72px] h-[22px] bg-black rounded-full" />
                            </div>

                            {/* Badge content */}
                            <div className="flex-1 flex items-center justify-center px-2 -mt-2">
                              <BadgeRenderer
                                zone={zone}
                                seed={`demo-${zone.zone_id}-preview`}
                                status="active"
                                showTimestamp={true}
                              />
                            </div>

                            {/* Home indicator */}
                            <div className="pb-1.5 flex justify-center">
                              <div className="w-[84px] h-[4px] bg-black rounded-full" />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center mb-8">
                      <div className="relative flex justify-center">
                        <div className="relative">
                          {/* Ambient glow */}
                          <div
                            className="absolute inset-0 -m-8 rounded-full opacity-30 blur-3xl"
                            style={{
                              background: 'radial-gradient(ellipse at center, #4A90D950 0%, transparent 70%)',
                            }}
                          />

                          {/* iPhone 15 Pro: 146.6 x 70.6mm = 2.077:1 - using 150w x 312h */}
                          <div className="relative" style={{ width: '150px', height: '312px' }}>
                            {/* Titanium frame */}
                            <div className="absolute inset-0 bg-[#1a1a1a] rounded-[32px] shadow-2xl" />
                            {/* Inner bezel */}
                            <div className="absolute inset-[2px] bg-black rounded-[30px]" />
                            {/* Screen */}
                            <div className="absolute inset-[4px] bg-[#fafaf9] rounded-[28px] overflow-hidden flex flex-col">
                              {/* Dynamic island */}
                              <div className="flex justify-center pt-2.5">
                                <div className="w-[72px] h-[22px] bg-black rounded-full" />
                              </div>

                              {/* Badge content */}
                              <div className="flex-1 flex items-center justify-center px-2 -mt-2">
                                <DemoBadge
                                  size={120}
                                  pattern="wave"
                                  primaryColor="#1B365D"
                                  secondaryColor="#4A90D9"
                                />
                              </div>

                              {/* Home indicator */}
                              <div className="pb-1.5 flex justify-center">
                                <div className="w-[84px] h-[4px] bg-black rounded-full" />
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Try scanning hint - below phone on mobile/tablet */}
                      <p className="text-center text-xs text-neutral-400 mt-4">
                        This is a real badge — try scanning it with another phone
                      </p>
                    </div>
                  )}

                  {/* CTAs */}
                  <div className="space-y-3 px-2 mt-8">
                    {zone ? (
                      <>
                        <button
                          onClick={handleJoin}
                          disabled={joining}
                          className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
                        >
                          {joining ? 'Starting...' : 'Start Verification — $0.99/mo'}
                        </button>
                        <button
                          onClick={handleSubsidy}
                          className="w-full py-3 text-sm text-neutral-500 hover:text-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 rounded-lg"
                        >
                          Can&apos;t pay? Get free sponsored access →
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={detectZone}
                        className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-lg shadow-neutral-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        Find My Neighborhood
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:flex lg:items-center lg:gap-16">
                  {/* Left - Content */}
                  <div className="flex-1">
                    {zone && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 rounded-full mb-6">
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: zone.color_primary }}
                        />
                        <span className="text-xs font-medium text-neutral-600">{zone.zone_name}</span>
                      </div>
                    )}

                    <h1 className="text-6xl xl:text-7xl font-bold text-neutral-900 tracking-tight leading-[1.05]">
                      You belong here.
                    </h1>

                    <p className="mt-6 text-xl text-neutral-500 max-w-lg leading-relaxed">
                      The privacy-first way to prove you live in your neighborhood. No name. No address. Just verified presence.
                    </p>

                    <div className="mt-8 flex items-center gap-4">
                      {zone ? (
                        <>
                          <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="px-8 py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
                          >
                            {joining ? 'Starting...' : 'Start Verification — $0.99/mo'}
                          </button>
                          <button
                            onClick={handleSubsidy}
                            className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 rounded-lg px-2"
                          >
                            Get free sponsored access →
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={detectZone}
                          className="px-8 py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-lg shadow-neutral-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          Find My Neighborhood
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right - Badge Preview - iPhone Mockup */}
                  <div className="flex-1 flex justify-center">
                    <div className="relative">
                      {/* Ambient glow */}
                      <div
                        className="absolute inset-0 -m-16 rounded-full opacity-30 blur-3xl"
                        style={{
                          background: zone
                            ? `radial-gradient(ellipse at center, ${zone.color_primary}50 0%, transparent 70%)`
                            : 'radial-gradient(ellipse at center, #4A90D950 0%, transparent 70%)',
                        }}
                      />

                      {/* iPhone 15 Pro: 146.6 x 70.6mm = 2.077:1 - using 240w x 498h */}
                      <div className="relative" style={{ width: '240px', height: '498px' }}>
                        {/* Titanium frame */}
                        <div className="absolute inset-0 bg-[#1a1a1a] rounded-[52px] shadow-2xl" />
                        {/* Inner bezel */}
                        <div className="absolute inset-[3px] bg-black rounded-[49px]" />
                        {/* Screen */}
                        <div className="absolute inset-[6px] bg-[#fafaf9] rounded-[46px] overflow-hidden flex flex-col">
                          {/* Dynamic island */}
                          <div className="flex justify-center pt-4">
                            <div className="w-[115px] h-[35px] bg-black rounded-full" />
                          </div>

                          {/* Badge content */}
                          <div className="flex-1 flex items-center justify-center px-4 -mt-4">
                            {zone ? (
                              <BadgeRenderer
                                zone={zone}
                                seed={`demo-${zone.zone_id}-preview`}
                                status="active"
                                showTimestamp={true}
                              />
                            ) : (
                              <DemoBadge
                                size={190}
                                pattern="wave"
                                primaryColor="#1B365D"
                                secondaryColor="#4A90D9"
                              />
                            )}
                          </div>

                          {/* Home indicator */}
                          <div className="pb-2 flex justify-center">
                            <div className="w-[134px] h-[5px] bg-black rounded-full" />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Trust bar */}
            <section className="border-t border-neutral-200 bg-neutral-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-600">
                  <span>No name</span>
                  <span className="text-neutral-300">|</span>
                  <span>No email</span>
                  <span className="text-neutral-300">|</span>
                  <span>No address</span>
                  <span className="text-neutral-300">|</span>
                  <span>No tracking</span>
                </div>
              </div>
            </section>

            {/* How it works */}
            <section className="border-t border-neutral-200 bg-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <div className="text-4xl font-bold text-neutral-200 mb-3">01</div>
                    <h3 className="font-semibold text-neutral-900 mb-2">Pay $0.99/month</h3>
                    <p className="text-sm text-neutral-600">
                      Create a 4-digit PIN. That&apos;s your badge password. Works in any browser, no app download.
                    </p>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-neutral-200 mb-3">02</div>
                    <h3 className="font-semibold text-neutral-900 mb-2">Sleep at home 14 nights</h3>
                    <p className="text-sm text-neutral-600">
                      Over the next 30 days. Background location checks if you&apos;re home at night. Move around during the day. We detect that too.
                    </p>
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-neutral-200 mb-3">03</div>
                    <h3 className="font-semibold text-neutral-900 mb-2">Badge goes live</h3>
                    <p className="text-sm text-neutral-600">
                      Animated, cryptographic, unforgeable. Anyone can scan it to verify you actually live here.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Fast-track option */}
            <section className="border-t border-neutral-200 bg-neutral-900 text-white">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-amber-400 font-semibold text-sm uppercase tracking-wide">Fast-track</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Skip the 14-day wait</h3>
                    <p className="text-neutral-400 text-sm max-w-md">
                      Pay $1,500 to get verified instantly. Price drops $107/day as you wait. 75% goes to sponsor neighbors who can&apos;t afford the monthly fee.
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-3xl font-bold">$1,500</div>
                    <div className="text-neutral-500 text-sm">Day 1 price</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Verification */}
            <section className="border-t border-neutral-200 bg-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-bold text-neutral-900 mb-6">
                    Anyone can verify you
                  </h2>
                  <div className="space-y-4 text-sm text-neutral-600">
                    <p>
                      Your badge has a live animation tied to a cryptographic seed. Screenshot it and the animation freezes. The timestamp stops. Instant fake detection.
                    </p>
                    <p>
                      Scan someone&apos;s badge with your camera. We check the seed against our database. Green checkmark = real neighbor. Red X = fake or revoked.
                    </p>
                    <p>
                      <strong className="text-neutral-900">You don&apos;t need an account to verify someone.</strong> Just scan.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Pricing breakdown */}
            <section className="border-t border-neutral-200 bg-neutral-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <h2 className="text-2xl font-bold text-neutral-900 mb-8">Pricing</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl p-6 border border-neutral-200">
                    <div className="text-2xl font-bold text-neutral-900 mb-1">$0.99<span className="text-base font-normal text-neutral-500">/mo</span></div>
                    <div className="text-sm text-neutral-600 mb-4">Standard verification</div>
                    <ul className="text-sm text-neutral-600 space-y-2">
                      <li>14 nights over 30 days</li>
                      <li>Movement verification</li>
                      <li>Live animated badge</li>
                      <li>Cancel anytime</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-xl p-6 border border-neutral-200">
                    <div className="text-2xl font-bold text-neutral-900 mb-1">$0<span className="text-base font-normal text-neutral-500">/mo</span></div>
                    <div className="text-sm text-neutral-600 mb-4">Community sponsored</div>
                    <ul className="text-sm text-neutral-600 space-y-2">
                      <li>Same verification process</li>
                      <li>Paid by fast-track fees</li>
                      <li>Gold ring on badge</li>
                      <li>Renew annually</li>
                    </ul>
                  </div>
                  <div className="bg-neutral-900 rounded-xl p-6 text-white">
                    <div className="text-2xl font-bold mb-1">$1,500<span className="text-base font-normal text-neutral-400"> max</span></div>
                    <div className="text-sm text-neutral-400 mb-4">Fast-track</div>
                    <ul className="text-sm text-neutral-400 space-y-2">
                      <li>Instant verification</li>
                      <li>Price drops $107/day</li>
                      <li>Min price: $50</li>
                      <li>75% sponsors others</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="border-t border-neutral-200 bg-white">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <h2 className="text-2xl font-bold text-neutral-900 mb-8">Questions</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-1">What data do you store?</h3>
                    <p className="text-sm text-neutral-600">
                      A device fingerprint and which neighborhood zone you verified in. No name, email, phone, or exact coordinates. We can&apos;t identify you.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-1">Can I fake my location?</h3>
                    <p className="text-sm text-neutral-600">
                      We detect GPS spoofing, VPNs, and emulators. We also check movement patterns. If you&apos;re not actually living there, we&apos;ll know.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-1">What if I move?</h3>
                    <p className="text-sm text-neutral-600">
                      Badge goes inactive. Start over in your new neighborhood with a new 14-day verification.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900 mb-1">Why $0.99/month?</h3>
                    <p className="text-sm text-neutral-600">
                      Covers server costs and makes it annoying for bad actors to create fake accounts. Not trying to get rich off this.
                    </p>
                  </div>
                </div>
                <div className="mt-8">
                  <a href="/faq" className="text-sm text-neutral-900 font-medium hover:underline">
                    More questions →
                  </a>
                </div>
              </div>
            </section>

            {/* Bottom CTA */}
            <section className="border-t border-neutral-200 bg-gradient-to-b from-neutral-50 to-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="max-w-2xl mx-auto text-center">
                  {zone && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-6">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-medium text-emerald-700">Now available in {zone.zone_name}</span>
                    </div>
                  )}

                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">
                    Ready to prove you belong?
                  </h2>
                  <p className="text-neutral-500 mb-8 text-lg">
                    Join your neighbors. Get verified in days, not weeks.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    {zone ? (
                      <>
                        <button
                          onClick={handleJoin}
                          disabled={joining}
                          className="w-full sm:w-auto px-10 py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neutral-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900"
                        >
                          {joining ? 'Starting...' : 'Start Verification — $0.99/mo'}
                        </button>
                        <button
                          onClick={handleSubsidy}
                          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 rounded-lg px-2"
                        >
                          Apply for free sponsored access →
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={detectZone}
                        className="w-full sm:w-auto px-10 py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-lg shadow-neutral-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        Find My Neighborhood
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-neutral-400 mt-6">
                    Cancel anytime. No contracts. Zero personal data stored.
                  </p>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-neutral-200 bg-neutral-900">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-neutral-900" />
                    </div>
                    <span className="text-sm font-semibold text-white">TrustCircle</span>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-neutral-400">
                    <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
                    <a href="/terms" className="hover:text-white transition-colors">Terms</a>
                    <a href="/faq" className="hover:text-white transition-colors">FAQ</a>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
                  <p className="text-xs text-neutral-400">
                    Zero personal data. Ever. Built with privacy as the foundation.
                  </p>
                </div>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
