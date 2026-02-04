'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getDeviceToken,
  getZone,
  getStatus,
  getSubscriptionType,
  getStripeCustomerId,
  clearAllStorage,
  isRegistered,
} from '@/lib/storage';
import { hasPin, verifyPin, validatePin, savePin, clearPin } from '@/lib/pin';
import { clearPresenceLog } from '@/lib/presence';
import { clearMovementLog } from '@/lib/movement';
import PinInput from '@/components/PinInput';
import ProtectedRoute from '@/components/ProtectedRoute';
import BottomNav from '@/components/ui/BottomNav';
import type { Zone, DeviceStatus, SubscriptionType } from '@/types';

type SettingsView = 'main' | 'change-pin-verify' | 'change-pin-new' | 'change-pin-confirm' | 'delete-confirm';

function SettingsPageContent() {
  const router = useRouter();
  const [view, setView] = useState<SettingsView>('main');
  const [zone, setZone] = useState<Zone | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | undefined>();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isRegistered()) {
      router.push('/');
      return;
    }

    setZone(getZone());
    setStatus(getStatus());
    setSubscriptionType(getSubscriptionType());
  }, [router]);

  const handleVerifyOldPin = (pin: string) => {
    if (verifyPin(pin)) {
      setPinError(undefined);
      setView('change-pin-new');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  const handleNewPin = (pin: string) => {
    const validation = validatePin(pin);
    if (!validation.valid) {
      setPinError(validation.error);
      return;
    }
    setNewPin(pin);
    setPinError(undefined);
    setView('change-pin-confirm');
  };

  const handleConfirmNewPin = (pin: string) => {
    if (pin !== newPin) {
      setPinError('PINs do not match');
      setView('change-pin-new');
      setNewPin('');
      return;
    }
    savePin(pin);
    setView('main');
  };

  const handleDeleteConfirm = async (pin: string) => {
    if (!verifyPin(pin)) {
      setPinError('Incorrect PIN');
      return;
    }

    setDeleting(true);

    try {
      const deviceToken = getDeviceToken();
      if (deviceToken) {
        await fetch('/api/device/deactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken }),
        });
      }

      clearPin();
      clearPresenceLog();
      clearMovementLog();
      clearAllStorage();

      router.push('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      setDeleting(false);
      setPinError('Failed to delete. Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    const customerId = getStripeCustomerId();
    if (!customerId) return;

    try {
      const response = await fetch('/api/checkout/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error);
    }
  };

  if (view === 'change-pin-verify') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <PinInput
            onComplete={handleVerifyOldPin}
            onCancel={() => setView('main')}
            title="Current PIN"
            subtitle="Enter your current PIN to continue"
            error={pinError}
          />
        </div>
      </div>
    );
  }

  if (view === 'change-pin-new') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <PinInput
            onComplete={handleNewPin}
            onCancel={() => setView('main')}
            title="New PIN"
            subtitle="Enter your new 6-digit PIN"
            error={pinError}
          />
        </div>
      </div>
    );
  }

  if (view === 'change-pin-confirm') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <PinInput
            onComplete={handleConfirmNewPin}
            onCancel={() => {
              setView('change-pin-new');
              setNewPin('');
            }}
            title="Confirm New PIN"
            subtitle="Enter your new PIN again"
            error={pinError}
          />
        </div>
      </div>
    );
  }

  if (view === 'delete-confirm') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full shadow-sm">
          <div className="mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-500 text-sm text-center font-medium">
              This will permanently delete your TrustCircle account and cancel your subscription.
            </p>
          </div>
          <PinInput
            onComplete={handleDeleteConfirm}
            onCancel={() => setView('main')}
            title="Confirm Deletion"
            subtitle="Enter your PIN to delete everything"
            error={pinError}
            disabled={deleting}
          />
        </div>
      </div>
    );
  }

  const statusLabels: Record<DeviceStatus, string> = {
    verifying: 'Verifying',
    active: 'Verified',
    inactive: 'Inactive',
    revoked: 'Revoked',
    failed: 'Failed',
    frozen: 'Frozen',
  };

  const statusColors: Record<DeviceStatus, string> = {
    verifying: 'text-amber-700',
    active: 'text-emerald-700',
    inactive: 'text-neutral-500',
    revoked: 'text-red-500',
    failed: 'text-red-500',
    frozen: 'text-neutral-500',
  };

  const statusBgColors: Record<DeviceStatus, string> = {
    verifying: 'bg-amber-50',
    active: 'bg-emerald-50',
    inactive: 'bg-neutral-100',
    revoked: 'bg-red-50',
    failed: 'bg-red-50',
    frozen: 'bg-neutral-100',
  };

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
          <span className="text-sm font-medium text-neutral-500">Settings</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-6 space-y-4">
        {/* Account Status Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-neutral-900">{zone?.zone_name || 'Your Neighborhood'}</h2>
                {status && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[status]} ${statusBgColors[status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : status === 'verifying' ? 'bg-amber-500' : 'bg-current'}`} />
                    {statusLabels[status]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium">Subscription</p>
                {subscriptionType === 'subsidized' ? (
                  <p className="text-amber-600 font-bold flex items-center gap-1.5 mt-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Community Subsidized
                  </p>
                ) : (
                  <p className="text-neutral-900 font-bold mt-1">$0.99/month</p>
                )}
              </div>
              {subscriptionType !== 'subsidized' && (
                <button
                  onClick={handleManageSubscription}
                  className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl font-semibold text-sm hover:bg-neutral-200 transition-colors"
                >
                  Manage
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h3 className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Security</h3>
          </div>
          <button
            onClick={() => setView('change-pin-verify')}
            className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-neutral-900 font-medium">Change PIN</span>
            </div>
            <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Community Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h3 className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Community</h3>
          </div>
          <button
            onClick={() => router.push('/alerts')}
            className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-neutral-900 font-medium">Community Alerts</span>
            </div>
            <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Legal Section */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h3 className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Legal</h3>
          </div>
          <a href="/privacy" className="block p-4 border-b border-neutral-200 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-neutral-900 font-medium">Privacy Policy</span>
              <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
          <a href="/terms" className="block p-4 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-neutral-900 font-medium">Terms of Service</span>
              <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900">TrustCircle</h3>
              <p className="text-xs text-neutral-400">Version 1.0.0</p>
            </div>
          </div>
          <p className="text-sm text-neutral-500">
            Verified community presence. Zero personal data stored. Ever.
          </p>
        </div>

        {/* Danger Zone */}
        <div className="pt-4">
          <button
            onClick={() => setView('delete-confirm')}
            className="w-full p-4 bg-red-50 border-2 border-red-100 text-red-500 rounded-2xl font-semibold hover:bg-red-100 hover:border-red-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Cancel Subscription & Delete Everything
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsPageContent />
    </ProtectedRoute>
  );
}
