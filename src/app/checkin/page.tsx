'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDeviceToken, isRegistered } from '@/lib/storage';
import PuzzleSlider from '@/components/PuzzleSlider';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface TouchPoint {
  x: number;
  y: number;
  t: number;
}

type CheckinStatus = 'loading' | 'ready' | 'verifying' | 'success' | 'failed' | 'expired' | 'error';

export default function CheckinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<CheckinStatus>('loading');
  const [message, setMessage] = useState('');
  const [checkinsCompleted, setCheckinsCompleted] = useState(0);
  const [checkinsRequired, setCheckinsRequired] = useState(3);

  const challengeId = searchParams.get('challenge');

  useEffect(() => {
    if (!isRegistered()) {
      router.push('/');
      return;
    }

    // Check if there's a pending check-in
    checkForPendingCheckin();
  }, [router]);

  const checkForPendingCheckin = async () => {
    const deviceToken = getDeviceToken();
    if (!deviceToken) {
      setStatus('error');
      setMessage('Device not registered');
      return;
    }

    try {
      const response = await fetch('/api/checkin/schedule', {
        headers: { 'x-device-token': deviceToken },
      });

      const data = await response.json();

      if (data.challenges) {
        const pending = data.challenges.find(
          (c: { status: string }) => c.status === 'sent'
        );

        if (pending) {
          setStatus('ready');
          setCheckinsCompleted(data.completed);
          setCheckinsRequired(data.total);
        } else if (data.completed >= data.total) {
          setStatus('success');
          setMessage('All check-ins completed!');
          setCheckinsCompleted(data.completed);
          setCheckinsRequired(data.total);
        } else {
          setStatus('ready');
          setMessage('No pending check-in right now');
          setCheckinsCompleted(data.completed);
          setCheckinsRequired(data.total);
        }
      } else {
        setStatus('ready');
      }
    } catch (error) {
      console.error('Failed to check for pending check-in:', error);
      setStatus('ready'); // Allow them to try anyway
    }
  };

  const handlePuzzleComplete = useCallback(async (touchData: { points: TouchPoint[]; duration: number }) => {
    setStatus('verifying');

    const deviceToken = getDeviceToken();
    if (!deviceToken) {
      setStatus('error');
      setMessage('Device not registered');
      return;
    }

    try {
      const response = await fetch('/api/checkin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': deviceToken,
        },
        body: JSON.stringify({
          challengeId,
          touchData,
        }),
      });

      const data = await response.json();

      if (data.expired) {
        setStatus('expired');
        setMessage('This check-in has expired. A new one will be sent soon.');
        return;
      }

      if (data.passed) {
        setStatus('success');
        setCheckinsCompleted(data.checkinsCompleted);
        setCheckinsRequired(data.checkinsRequired);
        setMessage('Verified! You\'re confirmed as human.');
      } else {
        setStatus('failed');
        setMessage('Verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Check-in verification failed:', error);
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }, [challengeId]);

  const handleCancel = () => {
    router.back();
  };

  const handleRetry = () => {
    setStatus('ready');
    setMessage('');
  };

  const handleContinue = () => {
    router.push('/verifying');
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="text-sm font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-blue-700">Check-in</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-neutral-500">Loading...</p>
          </div>
        )}

        {/* Ready to verify */}
        {status === 'ready' && (
          <div className="max-w-sm w-full">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 text-center mb-2">
              Quick verify
            </h1>
            <p className="text-neutral-500 text-center mb-8">
              Slide to confirm you&apos;re a real person
            </p>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {Array.from({ length: checkinsRequired }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < checkinsCompleted ? 'bg-emerald-500' : 'bg-neutral-200'
                  }`}
                />
              ))}
              <span className="text-sm text-neutral-500 ml-2">
                {checkinsCompleted}/{checkinsRequired}
              </span>
            </div>

            {/* Puzzle slider */}
            <PuzzleSlider onComplete={handlePuzzleComplete} onCancel={handleCancel} />
          </div>
        )}

        {/* Verifying */}
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-neutral-500">Verifying...</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Verified!
            </h1>
            <p className="text-neutral-500 mb-8">
              {message || `Check-in ${checkinsCompleted}/${checkinsRequired} complete`}
            </p>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {Array.from({ length: checkinsRequired }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < checkinsCompleted ? 'bg-emerald-500 scale-110' : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          </div>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Verification failed
            </h1>
            <p className="text-neutral-500 mb-8">
              {message}
            </p>

            <button
              onClick={handleRetry}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all mb-3"
            >
              Try again
            </button>

            <button
              onClick={handleCancel}
              className="w-full py-3 text-neutral-500 text-sm font-medium hover:text-neutral-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Expired */}
        {status === 'expired' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Check-in expired
            </h1>
            <p className="text-neutral-500 mb-8">
              {message}
            </p>

            <button
              onClick={handleContinue}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all"
            >
              Back to verification
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-neutral-500 mb-8">
              {message}
            </p>

            <button
              onClick={handleRetry}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all mb-3"
            >
              Try again
            </button>

            <button
              onClick={handleCancel}
              className="w-full py-3 text-neutral-500 text-sm font-medium hover:text-neutral-700 transition-colors"
            >
              Go back
            </button>
          </div>
        )}
      </main>

      {/* Footer hint */}
      <footer className="py-4 text-center safe-area-pb">
        <p className="text-xs text-neutral-400">
          This helps us verify you&apos;re a real person
        </p>
      </footer>
    </div>
  );
}
