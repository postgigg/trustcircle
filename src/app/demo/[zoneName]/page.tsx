'use client';

import { useParams } from 'next/navigation';
import DemoBadge from '@/components/DemoBadge';
import Link from 'next/link';

// Demo zones that can be viewed without PWA installation
const DEMO_ZONES: Record<string, {
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'wave' | 'pulse' | 'ripple' | 'spiral';
}> = {
  briarwood: {
    displayName: 'Briarwood',
    primaryColor: '#1B365D',
    secondaryColor: '#4A90D9',
    pattern: 'wave',
  },
  oakridge: {
    displayName: 'Oak Ridge',
    primaryColor: '#2D5016',
    secondaryColor: '#6B8E23',
    pattern: 'ripple',
  },
  riverside: {
    displayName: 'Riverside',
    primaryColor: '#1A4D5C',
    secondaryColor: '#4ECDC4',
    pattern: 'pulse',
  },
  maplewood: {
    displayName: 'Maplewood',
    primaryColor: '#8B4513',
    secondaryColor: '#D2691E',
    pattern: 'spiral',
  },
};

export default function DemoZonePage() {
  const params = useParams();
  const zoneName = params.zoneName as string;
  const zone = DEMO_ZONES[zoneName.toLowerCase()];

  if (!zone) {
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
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Demo Not Found</h1>
            <p className="text-neutral-500 mb-6">
              The demo zone &quot;{zoneName}&quot; doesn&apos;t exist.
            </p>
            <p className="text-sm text-neutral-400 mb-6">
              Available demos: {Object.keys(DEMO_ZONES).join(', ')}
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
          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-1 rounded-full">
            Demo Mode
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Zone name */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">{zone.displayName}</h1>
          <p className="text-sm text-neutral-500 mt-1">Verified Resident Badge</p>
        </div>

        {/* Badge display */}
        <div className="relative mb-8">
          {/* Ambient glow */}
          <div
            className="absolute inset-0 -m-12 rounded-full opacity-30 blur-3xl"
            style={{
              background: `radial-gradient(ellipse at center, ${zone.secondaryColor}50 0%, transparent 70%)`,
            }}
          />

          <DemoBadge
            size={280}
            pattern={zone.pattern}
            primaryColor={zone.primaryColor}
            secondaryColor={zone.secondaryColor}
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
            This is a demo badge for testing. Real badges are unique to each verified resident.
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
