'use client';

import { useState, useEffect } from 'react';
import PermissionsOnboarding from './PermissionsOnboarding';
import InstallPrompt from './InstallPrompt';
import { PaywallProvider } from '@/contexts/PaywallContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { initializeLocalSecurity, getUnreportedThreats, markThreatsReported } from '@/lib/local-security';
import { generateDeviceFingerprint, detectAutomation, detectHeadlessBrowser, detectEmulator } from '@/lib/device-fingerprint';

interface AppWrapperProps {
  children: React.ReactNode;
}

type AppMode = 'loading' | 'desktop' | 'mobile-browser' | 'pwa';

/**
 * Report detected threats to server (only sends threat type + fingerprint hash)
 * NO device details are transmitted - those stay in localStorage
 */
async function reportDetectedThreats(state: {
  isEmulator: boolean;
  isHeadless: boolean;
  isAutomation: boolean;
}) {
  try {
    const fingerprintHash = await generateDeviceFingerprint();

    const threats: string[] = [];
    if (state.isEmulator) threats.push('emulator');
    if (state.isHeadless) threats.push('headless');
    if (state.isAutomation) threats.push('automation');

    for (const threatType of threats) {
      await fetch('/api/security/report-threat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threatType,
          fingerprintHash,
        }),
      });
    }

    // Mark as reported
    markThreatsReported();
  } catch (error) {
    console.error('Failed to report threats:', error);
  }
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const [mode, setMode] = useState<AppMode>('loading');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check landing page synchronously from pathname (works on client)
  // We use a function to check this that will work during first render
  const getLandingPages = () => ['/', '/faq', '/privacy', '/terms', '/verify'];

  // Check if path is a public page (landing pages or demo routes)
  const isPublicPage = (path: string) => {
    return getLandingPages().includes(path) || path.startsWith('/demo');
  };

  const [currentPath, setCurrentPath] = useState<string | null>(null);

  useEffect(() => {
    // Set current path immediately
    setCurrentPath(window.location.pathname);

    // Detect device and app mode
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isMobile) {
      setMode('desktop');
    } else if (isStandalone) {
      // Running as installed PWA
      setMode('pwa');
      // Check if onboarding was completed
      const completed = localStorage.getItem('tc_permissions_onboarding');
      if (completed !== 'true') {
        setShowOnboarding(true);
      }

      // Register service worker for push notifications
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('Service worker registered:', registration.scope);
          })
          .catch((error) => {
            console.error('Service worker registration failed:', error);
          });
      }

      // Initialize local security (runs in background)
      initializeLocalSecurity()
        .then(({ state }) => {
          console.log('Local security initialized:', state);

          // If threats detected, report to server (only type + fingerprint hash)
          if (state.isEmulator || state.isHeadless || state.isAutomation) {
            reportDetectedThreats(state);
          }
        })
        .catch((error) => {
          console.error('Local security initialization failed:', error);
        });
    } else {
      // Mobile browser, not installed
      setMode('mobile-browser');
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Determine if we're on a public page (landing pages or demo routes)
  const isLandingPage = currentPath !== null && isPublicPage(currentPath);

  // If on public page (/, /faq, /privacy, /terms, /verify, /demo/*), always show the page content
  // regardless of desktop/mobile browser - these are public pages anyone can view
  if (isLandingPage) {
    return (
      <ToastProvider>
        <PaywallProvider>
          {children}
        </PaywallProvider>
      </ToastProvider>
    );
  }

  // Loading state - only show spinner for non-landing pages
  if (mode === 'loading' || currentPath === null) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
      </div>
    );
  }

  // Desktop trying to access app pages - show "use your phone" message
  if (mode === 'desktop') {
    return <DesktopMessage />;
  }

  // Mobile browser (not installed as PWA) trying to access app pages - show install prompt
  if (mode === 'mobile-browser') {
    return <MobileInstallScreen />;
  }

  // PWA mode - show onboarding or app
  if (showOnboarding) {
    return <PermissionsOnboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <ToastProvider>
      <PaywallProvider>
        {children}
        <InstallPrompt />
      </PaywallProvider>
    </ToastProvider>
  );
}

function DesktopMessage() {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <span className="text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          {/* Phone illustration */}
          <div className="relative w-48 h-80 mx-auto mb-8">
            {/* Phone frame */}
            <div className="absolute inset-0 bg-neutral-900 rounded-[3rem] p-2">
              <div className="w-full h-full bg-[#fafaf9] rounded-[2.5rem] overflow-hidden flex flex-col">
                {/* Dynamic island */}
                <div className="flex justify-center pt-3">
                  <div className="w-20 h-6 bg-neutral-900 rounded-full" />
                </div>
                {/* Screen content */}
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-3">
                    <div className="w-5 h-5 rounded-full bg-white" />
                  </div>
                  <div className="w-20 h-2 bg-neutral-200 rounded mb-2" />
                  <div className="w-16 h-2 bg-neutral-100 rounded" />
                </div>
                {/* Home indicator */}
                <div className="pb-2 flex justify-center">
                  <div className="w-24 h-1 bg-neutral-900 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-neutral-900 mb-3">
            Use Your Phone
          </h1>
          <p className="text-neutral-500 text-lg mb-6">
            TrustCircle is a mobile app that verifies you live in your neighborhood. Please open this page on your phone to continue.
          </p>

          {/* QR Code placeholder or URL */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-6">
            <p className="text-sm text-neutral-500 mb-4">Scan with your phone or visit:</p>
            <p className="text-neutral-900 font-mono text-sm bg-neutral-100 rounded-lg px-4 py-2">
              trustcircle.app
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-neutral-400">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Zero data stored
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Location verified
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs text-neutral-400">
            Zero personal data. Ever.
          </p>
        </div>
      </footer>
    </div>
  );
}

function MobileInstallScreen() {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#fafaf9] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
            <span className="text-sm font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-sm w-full text-center">
          {/* App Icon */}
          <div className="w-24 h-24 mx-auto mb-6 rounded-[1.5rem] bg-neutral-900 flex items-center justify-center shadow-lg">
            <div className="w-8 h-8 rounded-full bg-white" />
          </div>

          <h1 className="text-2xl font-bold text-neutral-900 mb-2">
            Install TrustCircle
          </h1>
          <p className="text-neutral-500 mb-8">
            Add TrustCircle to your home screen to verify your neighborhood residence.
          </p>

          {/* Install Instructions */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-6 text-left">
            <p className="text-sm font-semibold text-neutral-900 mb-4">How to install:</p>

            {isIOS ? (
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700">
                      Tap the <strong>Share</strong> button
                    </p>
                    <div className="mt-2 inline-flex items-center justify-center w-10 h-10 bg-neutral-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15" />
                      </svg>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700">
                      Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700">
                      Tap <strong>&quot;Add&quot;</strong> to confirm
                    </p>
                  </div>
                </li>
              </ol>
            ) : (
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700">
                      Tap the <strong>menu</strong> button
                    </p>
                    <div className="mt-2 inline-flex items-center justify-center w-10 h-10 bg-neutral-100 rounded-lg">
                      <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700">
                      Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <div className="flex-1">
                    <p className="text-sm text-neutral-700">
                      Tap <strong>&quot;Install&quot;</strong> to confirm
                    </p>
                  </div>
                </li>
              </ol>
            )}
          </div>

          {/* Why install */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-neutral-600">Access your badge instantly</p>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-neutral-600">Works offline</p>
            </div>
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-neutral-600">Full-screen experience</p>
            </div>
          </div>

          <p className="text-xs text-neutral-400">
            TrustCircle requires installation to verify your location and protect your privacy.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-4 safe-area-pb">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-xs text-neutral-400">
            Zero personal data. Ever.
          </p>
        </div>
      </footer>
    </div>
  );
}
