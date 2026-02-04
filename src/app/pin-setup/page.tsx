'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { validatePin, savePin, hasPin } from '@/lib/pin';
import { isRegistered, getZone } from '@/lib/storage';
import type { Zone } from '@/types';

export default function PinSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState<string>('');
  const [pin, setPin] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZoneData] = useState<Zone | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isRegistered()) {
      router.push('/');
      return;
    }

    if (hasPin()) {
      router.push('/badge');
      return;
    }

    setZoneData(getZone());
  }, [router]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [step]);

  useEffect(() => {
    if (error) {
      setPin(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [error]);

  const handlePinComplete = (pinValue: string) => {
    if (step === 'create') {
      const validation = validatePin(pinValue);
      if (!validation.valid) {
        setError(validation.error || 'Invalid PIN');
        return;
      }
      setFirstPin(pinValue);
      setError(null);
      setPin(['', '', '', '', '', '']);
      setStep('confirm');
    } else {
      if (pinValue !== firstPin) {
        setError("PINs don't match. Try again.");
        setStep('create');
        setFirstPin('');
        return;
      }
      savePin(pinValue);
      router.push('/verifying');
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];

    if (value.length > 1) {
      const digits = value.slice(0, 6 - index).split('');
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newPin[index + i] = digit;
        }
      });
      setPin(newPin);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();

      if (newPin.every(d => d !== '')) {
        handlePinComplete(newPin.join(''));
      }
    } else {
      newPin[index] = value;
      setPin(newPin);
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newPin.every(d => d !== '')) {
        handlePinComplete(newPin.join(''));
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newPin = [...pin];
      if (pin[index]) {
        newPin[index] = '';
      } else if (index > 0) {
        newPin[index - 1] = '';
        inputRefs.current[index - 1]?.focus();
      }
      setPin(newPin);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newPin = ['', '', '', '', '', ''];
      pasted.split('').forEach((digit, i) => {
        newPin[i] = digit;
      });
      setPin(newPin);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();

      if (newPin.every(d => d !== '')) {
        handlePinComplete(newPin.join(''));
      }
    }
  };

  const filledCount = pin.filter(d => d !== '').length;

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      {/* Header */}
      <header className="border-b border-neutral-200">
        <div className="max-w-lg mx-auto px-6 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          <span className="text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight">
            {step === 'create' ? 'Secure your badge.' : 'Confirm your PIN.'}
          </h1>
          <p className="mt-4 text-xl text-neutral-500">
            {step === 'create'
              ? 'Create a 6-digit PIN to protect your badge. This stays on your device only.'
              : 'Enter the same PIN again to confirm.'}
          </p>
        </div>

        {/* PIN Input */}
        <div className="mb-8">
          <div className="flex gap-3 justify-center">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`
                  w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all outline-none
                  ${digit
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-900 focus:border-neutral-400'
                  }
                  ${error ? 'border-red-500 bg-red-50' : ''}
                `}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Progress Dots */}
          <div className="flex justify-center gap-1.5 mt-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i < filledCount ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              setPin(['', '', '', '', '', '']);
              inputRefs.current[0]?.focus();
            }}
            className="px-6 py-2.5 text-neutral-500 hover:text-neutral-700 transition-colors text-sm font-medium"
          >
            Clear
          </button>
          {step === 'confirm' && (
            <button
              onClick={() => {
                setStep('create');
                setFirstPin('');
                setPin(['', '', '', '', '', '']);
                setError(null);
              }}
              className="px-6 py-2.5 text-neutral-500 hover:text-neutral-700 transition-colors text-sm font-medium"
            >
              Start Over
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="mt-12 pt-8 border-t border-neutral-200">
          <div className="flex justify-center gap-3 mb-4">
            <div className={`flex items-center gap-2 ${step === 'create' ? 'text-neutral-900' : 'text-neutral-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === 'create' ? 'bg-neutral-900 text-white' : 'bg-neutral-200'
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Create</span>
            </div>
            <div className="w-8 h-px bg-neutral-200 self-center" />
            <div className={`flex items-center gap-2 ${step === 'confirm' ? 'text-neutral-900' : 'text-neutral-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === 'confirm' ? 'bg-neutral-900 text-white' : 'bg-neutral-200'
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Confirm</span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 p-4 bg-neutral-100 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-neutral-900 text-sm">Your PIN never leaves this device</p>
              <p className="text-neutral-500 text-sm mt-1">
                If you forget it, you&apos;ll need to re-register. We can&apos;t recover it because we never store it.
              </p>
            </div>
          </div>
        </div>

        {/* Zone Info */}
        {zone && (
          <div className="mt-6 text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-neutral-400">Setting up for</p>
            <p className="text-neutral-700 font-medium mt-1">{zone.zone_name}</p>
          </div>
        )}
      </main>
    </div>
  );
}
