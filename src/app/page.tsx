'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Zone } from '@/types';
import { generateDeviceFingerprint, detectEmulator } from '@/lib/device-fingerprint';
import { isRegistered } from '@/lib/storage';
import BadgeRenderer from '@/components/BadgeRenderer';

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
    // Try to detect zone immediately - permissions should be granted from onboarding
    detectZone();
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
              setError('No zones in your area yet.');
            }
            setLoading(false);
          },
          (err) => {
            setLoading(false);
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionState('denied');
              setShowLocationDialog(true);
            } else {
              setError('Unable to get your location. Please try again.');
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

              <p className="text-neutral-500 mb-6">
                {permissionState === 'denied'
                  ? 'TrustCircle needs your location to verify you live in this neighborhood. Location is blocked in your browser settings.'
                  : 'TrustCircle needs your location to find your neighborhood and create your badge.'}
              </p>

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
        ) : zone ? (
          <>
            {/* Hero Section - Redesigned for mobile-first */}
            <section className="relative overflow-hidden">
              {/* Background gradient */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${zone.color_primary}, transparent)`,
                }}
              />

              <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8 sm:py-16 lg:py-20">
                {/* Mobile Layout */}
                <div className="lg:hidden">
                  {/* Zone badge - centered on mobile */}
                  <div className="flex justify-center mb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur border border-neutral-200 rounded-full">
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: zone.color_primary }}
                      />
                      <span className="text-xs font-medium text-neutral-600">{zone.zone_name}</span>
                    </div>
                  </div>

                  {/* Headline */}
                  <h1 className="text-[2.5rem] leading-[1.05] font-bold text-neutral-900 tracking-tight text-center mb-3">
                    You belong<br />here.
                  </h1>

                  <p className="text-base text-neutral-500 text-center mb-6 px-2">
                    The privacy-first way to prove neighborhood residence
                  </p>

                  {/* Badge Preview - Compact for mobile */}
                  <div className="relative flex justify-center mb-6">
                    <div className="relative w-[200px]">
                      {/* Subtle glow */}
                      <div
                        className="absolute inset-0 -m-4 rounded-3xl opacity-40 blur-2xl"
                        style={{
                          background: `radial-gradient(ellipse at center, ${zone.color_primary}30 0%, transparent 70%)`,
                        }}
                      />

                      {/* Badge card */}
                      <div className="relative bg-white rounded-3xl shadow-xl shadow-neutral-900/10 border border-neutral-200/50 p-4">
                        <BadgeRenderer
                          zone={zone}
                          seed={`demo-${zone.zone_id}-preview`}
                          status="active"
                          showTimestamp={true}
                        />

                        {/* Live indicator */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                          <div className="flex items-center gap-1.5 bg-neutral-900 px-3 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] text-white font-medium">Live badge</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="space-y-3 px-2 mt-8">
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-2xl hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-neutral-900/20"
                    >
                      {joining ? 'Starting...' : 'Get Your Badge — $0.99/mo'}
                    </button>
                    <button
                      onClick={handleSubsidy}
                      className="w-full py-3 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
                    >
                      Need sponsored access? →
                    </button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:flex lg:items-center lg:gap-16">
                  {/* Left - Content */}
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 rounded-full mb-6">
                      <div
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: zone.color_primary }}
                      />
                      <span className="text-xs font-medium text-neutral-600">{zone.zone_name}</span>
                    </div>

                    <h1 className="text-6xl xl:text-7xl font-bold text-neutral-900 tracking-tight leading-[1.05]">
                      You belong here.
                    </h1>

                    <p className="mt-6 text-xl text-neutral-500 max-w-lg leading-relaxed">
                      The privacy-first way to prove you live in your neighborhood. No name. No address. Just verified presence.
                    </p>

                    <div className="mt-8 flex items-center gap-4">
                      <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="px-8 py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-neutral-900/20"
                      >
                        {joining ? 'Starting...' : 'Get Your Badge — $0.99/mo'}
                      </button>
                      <button
                        onClick={handleSubsidy}
                        className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors py-2"
                      >
                        Get sponsored access →
                      </button>
                    </div>
                  </div>

                  {/* Right - Badge Preview */}
                  <div className="flex-1 flex justify-center">
                    <div className="relative">
                      <div
                        className="absolute inset-0 -m-12 rounded-full opacity-30 blur-3xl"
                        style={{
                          background: `radial-gradient(ellipse at center, ${zone.color_primary}40 0%, transparent 70%)`,
                        }}
                      />

                      <div className="relative w-[300px]">
                        <div className="bg-neutral-900 rounded-[2.5rem] p-2 shadow-2xl">
                          <div className="bg-black rounded-[2rem] overflow-hidden">
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                              <div className="w-20 h-6 bg-black rounded-full" />
                            </div>
                            <div className="bg-[#fafaf9] pt-12 pb-8 px-4">
                              <BadgeRenderer
                                zone={zone}
                                seed={`demo-${zone.zone_id}-preview`}
                                status="active"
                                showTimestamp={true}
                              />
                            </div>
                            <div className="bg-[#fafaf9] pb-2">
                              <div className="mx-auto w-24 h-1 bg-neutral-900/80 rounded-full" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-full shadow-lg border border-neutral-100">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs text-neutral-600 font-medium">Live preview</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Trust Indicators */}
            <section className="border-t border-neutral-200 bg-neutral-50">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-neutral-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Zero personal data stored</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>End-to-end encrypted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </div>
            </section>

            {/* What is TrustCircle */}
            <section className="border-t border-neutral-200 bg-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="max-w-3xl mx-auto text-center mb-12">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-4">What is TrustCircle?</p>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 leading-tight">
                    A verifiable badge that proves you actually live in your neighborhood
                  </h2>
                  <p className="mt-4 text-neutral-500 text-base sm:text-lg">
                    Unlike social media or ID verification, TrustCircle proves presence through behavior—not personal data. Your badge is live, cryptographic, and instantly verifiable.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                  <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-neutral-900 text-lg mb-2">Presence Verified</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      14 nights at home + natural movement patterns = verified neighbor. No utility bills. No mail. Just behavioral proof.
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-neutral-900 text-lg mb-2">Privacy by Design</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      We never store your name, email, address, or exact location. Your badge is tied to a device, not an identity.
                    </p>
                  </div>

                  <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-neutral-900 text-lg mb-2">Instantly Verifiable</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed">
                      Anyone can scan your badge to verify you&apos;re a real neighbor. Live animation + cryptographic proof = unforgeable.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Use Cases */}
            <section className="border-t border-neutral-200">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="max-w-3xl mx-auto text-center mb-12">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-4">Use Cases</p>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900">
                    Where TrustCircle helps
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: '🏠', title: 'HOA Meetings', desc: 'Verify voting eligibility without sharing personal info' },
                    { icon: '🛒', title: 'Local Marketplaces', desc: 'Buy/sell with verified neighbors, not strangers' },
                    { icon: '🐕', title: 'Pet Services', desc: 'Find trusted dog walkers in your actual community' },
                    { icon: '🚨', title: 'Emergency Alerts', desc: 'Real alerts from real neighbors, no outsiders' },
                    { icon: '🏋️', title: 'Community Groups', desc: 'Join local fitness groups with verified locals' },
                    { icon: '🔧', title: 'Contractor Referrals', desc: 'Get recommendations from actual neighbors' },
                    { icon: '🎉', title: 'Block Parties', desc: 'Coordinate events with verified residents only' },
                    { icon: '👋', title: 'New Neighbor Welcome', desc: 'Know when someone new joins your community' },
                  ].map((item, i) => (
                    <div key={i} className="bg-white border border-neutral-200 rounded-xl p-4 hover:border-neutral-300 hover:shadow-sm transition-all">
                      <span className="text-2xl mb-3 block">{item.icon}</span>
                      <h3 className="font-medium text-neutral-900 text-sm mb-1">{item.title}</h3>
                      <p className="text-xs text-neutral-500">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* How it works */}
            <section className="border-t border-neutral-200 bg-neutral-900 text-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="text-center mb-12">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-4">How it works</p>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                    Three steps to verified
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
                  {[
                    {
                      step: '01',
                      title: 'Sign up',
                      desc: '$0.99/month. No app download needed. Create a 4-digit PIN for your badge.',
                      detail: 'Works on any smartphone browser'
                    },
                    {
                      step: '02',
                      title: 'Live your life',
                      desc: 'Spend 14 nights at home over 30 days. Your phone quietly verifies presence.',
                      detail: 'Background location, minimal battery'
                    },
                    {
                      step: '03',
                      title: 'Get verified',
                      desc: 'Your live badge activates. Show it anywhere to prove you belong.',
                      detail: 'Unforgeable, instantly verifiable'
                    },
                  ].map((item, i) => (
                    <div key={i} className="text-center md:text-left">
                      <span className="text-5xl font-bold text-neutral-700">{item.step}</span>
                      <h3 className="text-xl font-semibold mt-4 mb-2">{item.title}</h3>
                      <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                      <p className="text-xs text-neutral-600 mt-3 uppercase tracking-wide">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* FAQ Preview */}
            <section className="border-t border-neutral-200 bg-white">
              <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="text-center mb-10">
                  <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900">
                    Common questions
                  </h2>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      q: 'What data do you collect?',
                      a: 'Only anonymized location pings to verify you sleep at home. No name, email, phone number, or exact address is ever stored.'
                    },
                    {
                      q: 'How is this different from Nextdoor?',
                      a: 'Nextdoor verifies your address with mail. TrustCircle verifies you actually live there through presence patterns—much harder to fake.'
                    },
                    {
                      q: 'Can I fake my location?',
                      a: 'We detect GPS spoofing, emulators, and VPNs. Our behavioral analysis catches patterns that don\'t match real residents.'
                    },
                    {
                      q: 'What happens if I move?',
                      a: 'Your badge becomes inactive. Start fresh in your new neighborhood—verify your presence there to get a new badge.'
                    },
                  ].map((item, i) => (
                    <div key={i} className="border border-neutral-200 rounded-xl p-5">
                      <h3 className="font-semibold text-neutral-900 mb-2">{item.q}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Bottom CTA */}
            <section className="border-t border-neutral-200 bg-gradient-to-b from-neutral-50 to-white">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                <div className="max-w-2xl mx-auto text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full mb-6">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-700">Now available in {zone.zone_name}</span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 mb-4">
                    Ready to prove you belong?
                  </h2>
                  <p className="text-neutral-500 mb-8 text-lg">
                    Join your neighbors. Get verified in days, not weeks.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="w-full sm:w-auto px-10 py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-neutral-900/20"
                    >
                      {joining ? 'Starting...' : 'Get Your Badge — $0.99/mo'}
                    </button>
                    <button
                      onClick={handleSubsidy}
                      className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors py-2"
                    >
                      Apply for sponsored access →
                    </button>
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
                  <p className="text-xs text-neutral-500">
                    Zero personal data. Ever. Built with privacy as the foundation.
                  </p>
                </div>
              </div>
            </footer>
          </>
        ) : null}
      </main>
    </div>
  );
}
