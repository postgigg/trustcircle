'use client';

import { useEffect, useState } from 'react';
import BadgeRenderer from '@/components/BadgeRenderer';
import type { Zone } from '@/types';

// Briarwood zone configuration
// This represents a real neighborhood - Briarwood, Queens, NYC
// Coordinates: approximately 40.7089, -73.8205
const BRIARWOOD_ZONE: Zone = {
  zone_id: 'h3-briarwood-nyc',
  zone_name: 'Briarwood',
  zone_boundary_hashes: null,
  h3_index: '842a107ffffffff', // H3 index for Briarwood area
  h3_resolution: 4,
  // Warm earth tones - inspired by fall foliage in Queens parks
  color_primary: '#8B4513', // Saddle brown
  color_secondary: '#D2691E', // Chocolate
  color_accent: '#228B22', // Forest green
  motion_pattern: 'ripple',
  active_resident_count: 847,
  created_at: new Date().toISOString(),
};

function generateLiveSeed(zoneId: string): string {
  // Generate a seed that changes every minute (simulating the real API behavior)
  const minute = Math.floor(Date.now() / 60000);
  const input = `${zoneId}:${minute}:demo-secret`;
  // Simple hash simulation for demo
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

export default function BriarwoodDemoPage() {
  const [seed, setSeed] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    // Update seed every minute
    const updateSeed = () => {
      setSeed(generateLiveSeed(BRIARWOOD_ZONE.zone_id));
      setLastUpdated(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }));
    };

    updateSeed();
    const interval = setInterval(updateSeed, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!seed) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Loading badge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Zone Badge */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-full shadow-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: BRIARWOOD_ZONE.color_primary }}
            />
            <span className="text-sm font-medium text-neutral-700">{BRIARWOOD_ZONE.zone_name}</span>
            <span className="text-xs text-neutral-400">Queens, NYC</span>
          </div>
        </div>

        {/* Badge Renderer */}
        <BadgeRenderer
          zone={BRIARWOOD_ZONE}
          seed={seed}
          status="active"
          isSubsidized={false}
          microVariation={0.015}
          showTimestamp={true}
        />

        {/* Info Cards */}
        <div className="mt-8 w-full max-w-sm space-y-4">
          {/* Resident Count */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">Verified Neighbors</p>
                  <p className="text-xs text-neutral-500">Active in Briarwood</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-neutral-900">{BRIARWOOD_ZONE.active_resident_count}</span>
            </div>
          </div>

          {/* Live Status */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">Live Badge</p>
                <p className="text-xs text-neutral-500">Pattern updates every minute</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-neutral-400">{lastUpdated}</span>
              </div>
            </div>
          </div>

          {/* Demo Notice */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900">Demo Badge</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  This is a demonstration of a live TrustCircle badge for the Briarwood neighborhood.
                  Real badges require 14 days of verified residence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-4">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-xs text-neutral-400">
            Zero personal data. Ever.
          </p>
        </div>
      </footer>
    </div>
  );
}
