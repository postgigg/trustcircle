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
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#2ECC71]/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#2ECC71]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#2C3E50]">Thank you!</h2>
          <p className="text-[#7F8C8D] mt-2">
            You have {vouchesRemaining - 1} vouches remaining this year.
          </p>
          <button
            onClick={onCancel}
            className="w-full mt-6 py-3 bg-[#1B365D] text-white rounded-xl font-semibold"
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
        <h2 className="text-xl font-bold text-[#2C3E50] text-center">
          Vouch for a neighbor?
        </h2>

        <div className="mt-4 p-4 bg-[#FAFAFA] rounded-xl">
          <p className="text-center text-[#7F8C8D]">
            <span className="font-semibold text-[#2C3E50]">{zoneName}</span>
            <br />
            Someone in your community is requesting subsidized access
          </p>
        </div>

        <p className="mt-4 text-sm text-[#7F8C8D] text-center">
          By vouching, you confirm this person is part of your community
        </p>

        {error && (
          <div className="mt-4 p-3 bg-[#E74C3C]/10 rounded-lg">
            <p className="text-[#E74C3C] text-sm text-center">{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 bg-[#FAFAFA] text-[#7F8C8D] rounded-xl font-semibold hover:bg-[#E0E0E0] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || vouchesRemaining <= 0}
            className="flex-1 py-3 bg-[#2ECC71] text-white rounded-xl font-semibold hover:bg-[#27AE60] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Vouching...' : 'Vouch'}
          </button>
        </div>

        {vouchesRemaining <= 0 && (
          <p className="mt-4 text-sm text-[#E74C3C] text-center">
            You have used all your vouches for this year
          </p>
        )}

        {vouchesRemaining > 0 && (
          <p className="mt-4 text-xs text-[#7F8C8D] text-center">
            You have {vouchesRemaining} vouches remaining this year
          </p>
        )}
      </div>
    </div>
  );
}
