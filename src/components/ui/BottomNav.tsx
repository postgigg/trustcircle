'use client';

import { ReactElement } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type NavItem = {
  path: string;
  paths?: string[]; // Additional paths that should activate this item
  label: string;
  icon: (active: boolean) => ReactElement;
};

const navItems: NavItem[] = [
  {
    path: '/badge',
    paths: ['/badge', '/verifying'],
    label: 'My Badge',
    icon: (active) => (
      <svg
        className="w-5 h-5"
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
      </svg>
    ),
  },
  {
    path: '/verify',
    label: 'Verify',
    icon: (active) => (
      <svg
        className="w-5 h-5"
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
        />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
  {
    path: '/alerts',
    label: 'Alerts',
    icon: (active) => (
      <svg
        className="w-5 h-5"
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (active) => (
      <svg
        className="w-5 h-5"
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

// Verifying state uses a different icon for badge
const verifyingIcon = (active: boolean) => (
  <svg
    className="w-5 h-5"
    fill={active ? 'currentColor' : 'none'}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

interface BottomNavProps {
  className?: string;
}

export default function BottomNav({ className = '' }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isVerifying = pathname === '/verifying';

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 safe-area-pb ${className}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.path ||
            (item.paths?.includes(pathname ?? '') ?? false);

          // Special handling for badge/verifying
          const icon =
            item.path === '/badge' && isVerifying
              ? verifyingIcon(isActive)
              : item.icon(isActive);

          const label = item.path === '/badge' && isVerifying ? 'Verifying' : item.label;

          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.path === '/badge' && isVerifying) {
                  router.push('/verifying');
                } else {
                  router.push(item.path);
                }
              }}
              className={`
                flex-1 py-3 flex flex-col items-center gap-1 transition-colors
                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900
                ${
                  isActive
                    ? 'text-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-900'
                }
              `}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              {icon}
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
