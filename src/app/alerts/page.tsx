'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getZone, isRegistered } from '@/lib/storage';
import AlertCard from '@/components/AlertCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Alert } from '@/types';

function AlertsPageContent() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [zoneName, setZoneName] = useState<string>('');

  const fetchAlerts = useCallback(async () => {
    const zone = getZone();
    if (!zone) return;

    setZoneName(zone.zone_name);

    try {
      const response = await fetch(`/api/alerts/${zone.zone_id}`);
      const data = await response.json();

      if (data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isRegistered()) {
      router.push('/');
      return;
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);

    return () => clearInterval(interval);
  }, [router, fetchAlerts]);

  const handleCorroborate = async (alertId: string) => {
    try {
      await fetch('/api/incident/corroborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: alertId }),
      });

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId
            ? { ...alert, corroborationCount: alert.corroborationCount + 1 }
            : alert
        )
      );
    } catch (error) {
      console.error('Failed to corroborate:', error);
    }
  };

  const handleDismiss = (alertId: string) => {
    setDismissedIds((prev) => new Set([...prev, alertId]));
  };

  const visibleAlerts = alerts.filter((alert) => !dismissedIds.has(alert.id));

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-neutral-500 text-sm tracking-wide">Loading alerts...</p>
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
          <div className="flex items-center gap-2">
            {zoneName && (
              <span className="text-xs text-neutral-500 hidden sm:block">{zoneName}</span>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-xs font-medium text-amber-700">Alerts</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-6 space-y-4">
        {visibleAlerts.length === 0 ? (
          <div className="py-12">
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-neutral-900">All Clear</h2>
              <p className="text-neutral-500 mt-2 max-w-xs mx-auto">
                No active alerts in your neighborhood. Your community is safe.
              </p>

              <div className="mt-6 p-4 bg-neutral-100 rounded-xl">
                <p className="text-sm text-neutral-500">
                  Alerts are community-generated and expire automatically after 24 hours.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Active Alert Count */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Active Alerts
              </h2>
              <span className="px-2.5 py-0.5 bg-red-50 text-red-500 rounded-full text-xs font-bold">
                {visibleAlerts.length}
              </span>
            </div>

            {/* Alert Cards */}
            {visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onCorroborate={handleCorroborate}
                onDismiss={handleDismiss}
              />
            ))}

            {/* Info Banner */}
            <div className="p-4 bg-neutral-100 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Only verified residents can report and corroborate alerts. All reports expire after 24 hours.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 safe-area-pb">
        <div className="flex max-w-lg mx-auto">
          <button
            onClick={() => router.push('/badge')}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="5" />
            </svg>
            <span className="text-xs font-medium">My Badge</span>
          </button>

          <button
            onClick={() => router.push('/verify')}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-xs font-medium">Verify</span>
          </button>

          <button className="flex-1 py-3 flex flex-col items-center gap-1 text-neutral-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-medium">Alerts</span>
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="flex-1 py-3 flex flex-col items-center gap-1 text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <ProtectedRoute>
      <AlertsPageContent />
    </ProtectedRoute>
  );
}
