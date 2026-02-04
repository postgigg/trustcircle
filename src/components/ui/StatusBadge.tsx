'use client';

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showDot?: boolean;
  pulseDot?: boolean;
  className?: string;
}

const statusStyles: Record<StatusType, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-500',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-600',
    dot: 'bg-neutral-500',
  },
};

export default function StatusBadge({
  status,
  label,
  showDot = true,
  pulseDot = false,
  className = '',
}: StatusBadgeProps) {
  const styles = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${styles.bg} ${styles.text} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${styles.dot} ${pulseDot ? 'animate-pulse' : ''}`}
        />
      )}
      {label}
    </span>
  );
}
