'use client';

import { useState } from 'react';

interface VouchConfirmProps {
  zoneName: string;
  vouchesRemaining: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function VouchConfirm({
  zoneName,
  vouchesRemaining,
  onConfirm,
  onCancel,
}: VouchConfirmProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vouch. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Sponsorship Recorded!</h2>
          <p className="text-neutral-500 mt-2">
            You&apos;ve helped a neighbor join TrustCircle.
          </p>
          <div className="mt-4 p-3 bg-neutral-100 rounded-xl">
            <p className="text-sm text-neutral-600">
              <span className="font-semibold">{vouchesRemaining - 1}</span> sponsorships remaining this year
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-full mt-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <h2 className="text-xl font-bold text-neutral-900 text-center">
          Sponsor a neighbor?
        </h2>

        <div className="mt-4 p-4 bg-neutral-100 rounded-xl">
          <p className="text-center text-neutral-600">
            <span className="font-semibold text-neutral-900">{zoneName}</span>
            <br />
            Someone in your community is requesting free access
          </p>
        </div>

        <p className="mt-4 text-sm text-neutral-500 text-center">
          By sponsoring, you confirm this person lives in your neighborhood
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || vouchesRemaining <= 0}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sponsoring...' : 'Sponsor'}
          </button>
        </div>

        {vouchesRemaining <= 0 && (
          <p className="mt-4 text-sm text-red-500 text-center">
            You&apos;ve used all your sponsorships for this year
          </p>
        )}

        {vouchesRemaining > 0 && (
          <p className="mt-4 text-xs text-neutral-400 text-center">
            {vouchesRemaining} sponsorship{vouchesRemaining !== 1 ? 's' : ''} remaining this year
          </p>
        )}
      </div>
    </div>
  );
}
