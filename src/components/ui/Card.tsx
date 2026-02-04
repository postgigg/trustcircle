'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className = '', interactive = false, onClick }: CardProps) {
  const baseClasses = 'bg-white border border-neutral-200 rounded-xl';
  const interactiveClasses = interactive
    ? 'cursor-pointer hover:border-neutral-300 hover:shadow-sm active:scale-[0.99] transition-all'
    : '';
  const shadowClasses = interactive ? 'shadow-sm' : '';

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={`${baseClasses} ${interactiveClasses} ${shadowClasses} ${className}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Component>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-4 py-3 bg-neutral-50 border-b border-neutral-200 ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
