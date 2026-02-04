'use client';

import { useState, useRef, useEffect } from 'react';

interface PinInputProps {
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  error?: string;
  disabled?: boolean;
}

export default function PinInput({
  onComplete,
  onCancel,
  title = 'Enter PIN',
  subtitle,
  error,
  disabled = false,
}: PinInputProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '', '', '']);
  const [focused, setFocused] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (pin.every(d => d !== '') && pin.length === 6) {
      onComplete(pin.join(''));
    }
  }, [pin, onComplete]);

  // Reset pin when error changes
  useEffect(() => {
    if (error) {
      setPin(['', '', '', '', '', '']);
      setFocused(0);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [error]);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;

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
      setFocused(nextIndex);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newPin[index] = value;
      setPin(newPin);
      if (value && index < 5) {
        setFocused(index + 1);
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      const newPin = [...pin];
      if (pin[index]) {
        newPin[index] = '';
      } else if (index > 0) {
        newPin[index - 1] = '';
        setFocused(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
      setPin(newPin);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setFocused(index - 1);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      setFocused(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return;

    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newPin = [...pin];
      pasted.split('').forEach((digit, i) => {
        newPin[i] = digit;
      });
      setPin(newPin);
      const nextIndex = Math.min(pasted.length, 5);
      setFocused(nextIndex);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const clearPin = () => {
    setPin(['', '', '', '', '', '']);
    setFocused(0);
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#2C3E50]">{title}</h2>
        {subtitle && <p className="mt-2 text-[#7F8C8D] text-sm">{subtitle}</p>}
      </div>

      {/* PIN Input Grid */}
      <div className="flex gap-3">
        {pin.map((digit, index) => (
          <div key={index} className="relative">
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => setFocused(index)}
              onPaste={handlePaste}
              disabled={disabled}
              className={`
                w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all duration-200 outline-none
                ${focused === index
                  ? 'border-[#4A90D9] ring-4 ring-[#4A90D9]/20 bg-[#4A90D9]/5'
                  : 'border-[#E0E0E0] hover:border-[#7F8C8D]'
                }
                ${error ? 'border-[#E74C3C] bg-[#E74C3C]/5 animate-shake' : 'bg-white'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${digit ? 'text-[#1B365D]' : 'text-[#7F8C8D]'}
              `}
            />
            {/* Dot indicator when filled */}
            {digit && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
            )}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-[#E74C3C]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 mt-2">
        <button
          onClick={clearPin}
          disabled={disabled}
          className="px-6 py-2.5 text-[#7F8C8D] hover:text-[#2C3E50] hover:bg-[#FAFAFA] rounded-xl transition-colors disabled:opacity-50 font-medium"
        >
          Clear
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={disabled}
            className="px-6 py-2.5 text-[#4A90D9] hover:bg-[#4A90D9]/10 rounded-xl transition-colors disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
        )}
      </div>

      {/* PIN Progress */}
      <div className="flex gap-1.5 mt-2">
        {pin.map((digit, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              digit ? 'bg-[#4A90D9]' : 'bg-[#E0E0E0]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
