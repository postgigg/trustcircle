'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface PermissionsOnboardingProps {
  onComplete: () => void;
}

type PermissionStep = 'welcome' | 'location' | 'location-denied' | 'camera' | 'camera-denied' | 'complete';
type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

export default function PermissionsOnboarding({ onComplete }: PermissionsOnboardingProps) {
  const [step, setStep] = useState<PermissionStep>('welcome');
  const [locationStatus, setLocationStatus] = useState<PermissionStatus>('unknown');
  const [cameraStatus, setCameraStatus] = useState<PermissionStatus>('unknown');
  const [requesting, setRequesting] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem('tc_permissions_onboarding');
    if (completed === 'true') {
      onComplete();
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    // Log debug info
    const info = [
      `iOS: ${iOS}`,
      `Standalone: ${window.matchMedia('(display-mode: standalone)').matches}`,
      `Geolocation: ${'geolocation' in navigator}`,
      `MediaDevices: ${!!navigator.mediaDevices}`,
      `getUserMedia: ${!!(navigator.mediaDevices?.getUserMedia)}`,
      `Protocol: ${window.location.protocol}`,
    ].join(' | ');
    console.log('TrustCircle Debug:', info);
    setDebugInfo(info);
  }, [onComplete]);

  const requestLocation = useCallback(() => {
    console.log('requestLocation called');
    setRequesting(true);

    // Check if geolocation is available
    if (!('geolocation' in navigator)) {
      console.log('Geolocation not available');
      setLocationStatus('unavailable');
      setStep('location-denied');
      setRequesting(false);
      return;
    }

    console.log('Calling getCurrentPosition...');

    // Direct callback approach - required for iOS Safari PWA to maintain user gesture context
    // Do NOT use Promise wrapper or async/await - iOS breaks the gesture chain
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success - permission was granted
        console.log('Location granted:', position.coords.latitude, position.coords.longitude);
        setLocationStatus('granted');
        setStep('camera');
        setRequesting(false);
      },
      (geoError) => {
        // Error - permission denied or unavailable
        console.log('Location error:', geoError.code, geoError.message);

        if (geoError.code === 1) { // PERMISSION_DENIED
          setLocationStatus('denied');
          setStep('location-denied');
        } else if (geoError.code === 2) { // POSITION_UNAVAILABLE
          setLocationStatus('unavailable');
          setStep('location-denied');
        } else {
          // Timeout or other error
          setLocationStatus('denied');
          setStep('location-denied');
        }
        setRequesting(false);
      },
      {
        enableHighAccuracy: false, // Try with lower accuracy first - more likely to trigger prompt
        timeout: 60000, // Longer timeout for iOS
        maximumAge: 0,
      }
    );
  }, []);

  const requestCamera = useCallback(() => {
    console.log('requestCamera called');
    setRequesting(true);

    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.log('MediaDevices not available');
      setCameraStatus('unavailable');
      setStep('camera-denied');
      setRequesting(false);
      return;
    }

    console.log('Creating video element for iOS...');

    // For iOS Safari PWA, we need to create a video element and attach the stream
    // This is required for iOS to properly trigger the permission dialog
    const videoElement = document.createElement('video');
    videoElement.setAttribute('playsinline', 'true'); // Required for iOS
    videoElement.setAttribute('autoplay', 'true');
    videoElement.setAttribute('muted', 'true');
    videoElement.muted = true;
    videoElement.style.position = 'fixed';
    videoElement.style.top = '50%';
    videoElement.style.left = '50%';
    videoElement.style.width = '1px';
    videoElement.style.height = '1px';
    videoElement.style.opacity = '0.01';
    document.body.appendChild(videoElement);

    console.log('Calling getUserMedia...');

    // For iOS Safari PWA, getUserMedia must be called directly from user gesture
    // Using .then/.catch instead of async/await to maintain gesture context
    navigator.mediaDevices.getUserMedia({
      video: true // Simplest possible constraint for iOS
    })
    .then((stream) => {
      console.log('Got stream, attaching to video element...');
      // Attach stream to video element (required for iOS)
      videoElement.srcObject = stream;

      // Try to play
      videoElement.play().catch(() => {});

      // Permission granted - stop the stream and clean up
      console.log('Camera granted');
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        if (document.body.contains(videoElement)) {
          document.body.removeChild(videoElement);
        }
      }, 200);

      setCameraStatus('granted');
      setStep('complete');
      setRequesting(false);
    })
    .catch((error) => {
      // Clean up video element
      if (document.body.contains(videoElement)) {
        document.body.removeChild(videoElement);
      }

      const mediaError = error as DOMException;
      console.log('Camera error:', mediaError.name, mediaError.message);

      if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
        setCameraStatus('denied');
        setStep('camera-denied');
      } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
        setCameraStatus('unavailable');
        setStep('camera-denied');
      } else {
        // Log full error for debugging
        console.log('Unknown camera error:', error);
        setCameraStatus('denied');
        setStep('camera-denied');
      }
      setRequesting(false);
    });
  }, []);

  const finishOnboarding = () => {
    localStorage.setItem('tc_permissions_onboarding', 'true');
    onComplete();
  };

  const continueWithoutPermission = (nextStep: PermissionStep) => {
    setStep(nextStep);
  };

  const openSettings = () => {
    // Can't programmatically open settings, so just show instructions
    alert(isIOS
      ? 'Open Settings > Safari > Location (or Camera) to enable permissions for this website.'
      : 'Open Settings > Site Settings > Permissions to enable Location and Camera.'
    );
  };

  return (
    <div className="fixed inset-0 min-h-[100dvh] bg-[#fafaf9] flex flex-col z-50">
      {/* Progress dots */}
      <div className="flex-shrink-0 pt-safe">
        <div className="flex justify-center gap-2 py-6">
          {['welcome', 'location', 'camera', 'complete'].map((s, i) => {
            const currentIndex = ['welcome', 'location', 'location-denied', 'camera', 'camera-denied', 'complete'].indexOf(step);
            const stepIndex = ['welcome', 'location', 'camera', 'complete'].indexOf(s);
            const isActive = (step === s) ||
              (s === 'location' && step === 'location-denied') ||
              (s === 'camera' && step === 'camera-denied');
            const isPast = (s === 'welcome' && currentIndex > 0) ||
              (s === 'location' && currentIndex > 2) ||
              (s === 'camera' && currentIndex > 4);

            return (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  isActive
                    ? 'w-6 bg-neutral-900'
                    : isPast
                    ? 'w-2 bg-neutral-900'
                    : 'w-2 bg-neutral-300'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Debug info - REMOVE IN PRODUCTION */}
      {debugInfo && (
        <div className="fixed top-20 left-2 right-2 p-2 bg-black/80 rounded text-[10px] text-white font-mono z-50 break-all">
          {debugInfo}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe overflow-y-auto">

        {/* WELCOME */}
        {step === 'welcome' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-neutral-900 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-white" />
            </div>

            <h1 className="text-3xl font-bold text-neutral-900 mb-3">
              Welcome to TrustCircle
            </h1>
            <p className="text-neutral-500 text-lg mb-8">
              Prove you belong here with a live badge. No name. No address. Just presence.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl text-left">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Location Access</p>
                  <p className="text-sm text-neutral-500">To verify your neighborhood</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl text-left">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-900">Camera Access</p>
                  <p className="text-sm text-neutral-500">To scan and verify badges</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('location')}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all"
            >
              Get Started
            </button>

            <p className="text-xs text-neutral-400 mt-4">
              Zero personal data stored. Ever.
            </p>
          </div>
        )}

        {/* LOCATION REQUEST */}
        {step === 'location' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              Allow Location Access
            </h1>
            <p className="text-neutral-500 mb-6">
              TrustCircle needs your location to verify you live in your neighborhood.
            </p>

            {/* Important notice for iOS */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-900">Tap &quot;Allow&quot; when prompted</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {isIOS
                      ? 'Select "Allow While Using App" to enable location.'
                      : 'Select "Allow" or "While using the app" to enable location.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy box */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-900">Your exact location is never stored</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Only your neighborhood zone is saved.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={requestLocation}
              disabled={requesting}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {requesting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Waiting for permission...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  Allow Location
                </>
              )}
            </button>
          </div>
        )}

        {/* LOCATION DENIED */}
        {step === 'location-denied' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              Location Access Denied
            </h1>
            <p className="text-neutral-500 mb-6">
              TrustCircle needs location access to work. Please enable it in your settings.
            </p>

            {/* Instructions */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-6 text-left">
              <p className="text-sm font-semibold text-neutral-900 mb-4">To enable location:</p>

              {isIOS ? (
                <ol className="space-y-3 text-sm text-neutral-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                    <span>Open your iPhone <strong>Settings</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                    <span>Scroll down and tap <strong>Safari</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                    <span>Tap <strong>Location</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                    <span>Select <strong>Allow</strong> or <strong>Ask</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
                    <span>Come back and tap <strong>Try Again</strong></span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-neutral-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                    <span>Tap the <strong>lock icon</strong> in the address bar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                    <span>Tap <strong>Permissions</strong> or <strong>Site settings</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                    <span>Find <strong>Location</strong> and set to <strong>Allow</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                    <span>Come back and tap <strong>Try Again</strong></span>
                  </li>
                </ol>
              )}
            </div>

            <button
              onClick={requestLocation}
              disabled={requesting}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 mb-3"
            >
              {requesting ? 'Checking...' : 'Try Again'}
            </button>

            <button
              onClick={() => continueWithoutPermission('camera')}
              className="w-full py-3 text-neutral-500 text-sm font-medium hover:text-neutral-900 transition-colors"
            >
              Continue without location
            </button>
          </div>
        )}

        {/* CAMERA REQUEST */}
        {step === 'camera' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-purple-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>

            {/* Location success badge */}
            {locationStatus === 'granted' && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-6">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Location enabled
              </div>
            )}

            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              Allow Camera Access
            </h1>
            <p className="text-neutral-500 mb-6">
              Use your camera to scan and verify other residents&apos; badges.
            </p>

            {/* Important notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-900">Tap &quot;Allow&quot; when prompted</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Allow camera access to scan badges.
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy box */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-900">No photos or videos stored</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Camera is only used for real-time scanning.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={requestCamera}
              disabled={requesting}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {requesting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Waiting for permission...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Allow Camera
                </>
              )}
            </button>

            <button
              onClick={() => continueWithoutPermission('complete')}
              className="w-full py-3 text-neutral-500 text-sm font-medium hover:text-neutral-900 transition-colors mt-3"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* CAMERA DENIED */}
        {step === 'camera-denied' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              Camera Access Denied
            </h1>
            <p className="text-neutral-500 mb-6">
              Camera access is needed to scan badges. Please enable it in your settings.
            </p>

            {/* Instructions */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-6 text-left">
              <p className="text-sm font-semibold text-neutral-900 mb-4">To enable camera:</p>

              {isIOS ? (
                <ol className="space-y-3 text-sm text-neutral-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                    <span>Open your iPhone <strong>Settings</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                    <span>Scroll down and tap <strong>Safari</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                    <span>Tap <strong>Camera</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                    <span>Select <strong>Allow</strong> or <strong>Ask</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
                    <span>Come back and tap <strong>Try Again</strong></span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-neutral-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                    <span>Tap the <strong>lock icon</strong> in the address bar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                    <span>Tap <strong>Permissions</strong> or <strong>Site settings</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                    <span>Find <strong>Camera</strong> and set to <strong>Allow</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                    <span>Come back and tap <strong>Try Again</strong></span>
                  </li>
                </ol>
              )}
            </div>

            <button
              onClick={requestCamera}
              disabled={requesting}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50 mb-3"
            >
              {requesting ? 'Checking...' : 'Try Again'}
            </button>

            <button
              onClick={() => continueWithoutPermission('complete')}
              className="w-full py-3 text-neutral-500 text-sm font-medium hover:text-neutral-900 transition-colors"
            >
              Continue without camera
            </button>
          </div>
        )}

        {/* COMPLETE */}
        {step === 'complete' && (
          <div className="max-w-sm w-full text-center">
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              You&apos;re All Set!
            </h1>
            <p className="text-neutral-500 mb-8">
              TrustCircle is ready. Let&apos;s find your neighborhood.
            </p>

            {/* Permission status */}
            <div className="space-y-3 mb-8">
              <div className={`flex items-center gap-3 p-4 rounded-xl text-left ${
                locationStatus === 'granted'
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-red-50 border border-red-100'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  locationStatus === 'granted' ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  {locationStatus === 'granted' ? (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  locationStatus === 'granted' ? 'text-emerald-900' : 'text-red-900'
                }`}>
                  {locationStatus === 'granted' ? 'Location enabled' : 'Location not enabled'}
                </span>
              </div>

              <div className={`flex items-center gap-3 p-4 rounded-xl text-left ${
                cameraStatus === 'granted'
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-red-50 border border-red-100'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  cameraStatus === 'granted' ? 'bg-emerald-100' : 'bg-red-100'
                }`}>
                  {cameraStatus === 'granted' ? (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  cameraStatus === 'granted' ? 'text-emerald-900' : 'text-red-900'
                }`}>
                  {cameraStatus === 'granted' ? 'Camera enabled' : 'Camera not enabled'}
                </span>
              </div>
            </div>

            <button
              onClick={finishOnboarding}
              className="w-full py-4 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.98] transition-all"
            >
              Continue to TrustCircle
            </button>

            {(locationStatus !== 'granted' || cameraStatus !== 'granted') && (
              <p className="text-xs text-neutral-400 mt-4">
                You can enable permissions anytime in Settings.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
