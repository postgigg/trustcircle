'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import LoadingSpinner from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.98] shadow-lg shadow-neutral-900/20 disabled:bg-neutral-400',
  secondary:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:scale-[0.98] disabled:bg-neutral-100 disabled:text-neutral-400',
  ghost:
    'bg-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:text-neutral-300',
  danger:
    'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] shadow-lg shadow-red-500/20 disabled:bg-red-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-sm rounded-xl',
  lg: 'px-8 py-4 text-base rounded-2xl',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`
        font-semibold transition-all
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && <LoadingSpinner size="sm" />}
        {children}
      </span>
    </button>
  );
}
