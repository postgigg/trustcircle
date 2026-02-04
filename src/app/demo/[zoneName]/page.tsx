'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import BadgeRenderer from '@/components/BadgeRenderer';
import Link from 'next/link';
import type { Zone } from '@/types';

export default function DemoZonePage() {
  const params = useParams();
  const zoneName = params.zoneName as string;
  const [zone, setZone] = useState<Zone | null>(null);
  const [seed, setSeed] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch zone data from database
  useEffect(() => {
    const fetchZone = async () => {
      try {
        // Try demo-prefixed zone ID first, then raw name
        const zoneId = `demo-${zoneName.toLowerCase()}`;
        const res = await fetch(`/api/zone/${zoneId}/preview`);

        if (res.ok) {
          const data = await res.json();
          setZone(data.zone);
        } else {
          setError(`Zone "${zoneName}" not found`);
        }
      } catch (err) {
        console.error('Failed to fetch zone:', err);
        setError('Failed to load zone');
      } finally {
        setLoading(false);
      }
    };

    fetchZone();
  }, [zoneName]);

  // Fetch real time-synced seed from API
  useEffect(() => {
    if (!zone) return;

    const fetchSeed = async () => {
      try {
        const res = await fetch(`/api/badge/seed?zoneId=${zone.zone_id}`);
        if (res.ok) {
          const data = await res.json();
          setSeed(data.seed);
        }
      } catch (err) {
        console.error('Failed to fetch seed:', err);
      }
    };

    fetchSeed();
    // Refresh seed every 30 seconds (seeds change every minute)
    const interval = setInterval(fetchSeed, 30000);
    return () => clearInterval(interval);
  }, [zone]);

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-neutral-500">Loading zone...</p>
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
        <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <span className="text-sm font-semibold text-neutral-900">TrustCircle</span>
            </Link>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Zone Not Found</h1>
            <p className="text-neutral-500 mb-6">
              {error || `The zone "${zoneName}" doesn't exist in the database.`}
            </p>
            <Link
              href="/"
              className="inline-block py-3 px-6 bg-neutral-900 text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show loading while seed is being fetched
  if (!seed) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-neutral-500">Loading badge...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="text-sm font-semibold text-neutral-900">TrustCircle</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Zone name */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">{zone.zone_name}</h1>
          <p className="text-sm text-neutral-500 mt-1">Verified Resident Badge</p>
        </div>

        {/* Badge display - uses REAL BadgeRenderer with time-synced seed */}
        <div className="relative mb-8">
          {/* Ambient glow */}
          <div
            className="absolute inset-0 -m-12 rounded-full opacity-30 blur-3xl"
            style={{
              background: `radial-gradient(ellipse at center, ${zone.color_secondary}50 0%, transparent 70%)`,
            }}
          />

          <BadgeRenderer
            zone={zone}
            seed={seed}
            status="active"
            showTimestamp={true}
          />
        </div>

        {/* Instructions */}
        <div className="max-w-sm text-center">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <svg className="w-5 h-5 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-semibold text-neutral-900">Scan this badge</span>
            </div>
            <p className="text-sm text-neutral-500">
              Use another phone to scan this badge and verify it&apos;s a real TrustCircle resident.
            </p>
          </div>

          <Link
            href="/verify"
            className="inline-flex items-center gap-2 py-3 px-6 bg-neutral-900 text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Verify Someone
          </Link>

          <p className="text-xs text-neutral-400 mt-4">
            Badge animation is time-synced and cryptographically verified.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-4">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-xs text-neutral-400">
            TrustCircle — Zero personal data. Ever.
          </p>
        </div>
      </footer>
    </div>
  );
}
