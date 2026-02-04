'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface ScannerProps {
  onResult: (success: boolean, zoneName?: string) => void;
  onCancel: () => void;
}

export default function Scanner({ onResult, onCancel }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [permissionState, setPermissionState] = useState<'prompt' | 'denied' | 'granted' | 'unknown'>('unknown');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const analysisRef = useRef<number>(0);

  const startCamera = useCallback(async () => {
    setShowPermissionDialog(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setPermissionState('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setPermissionState('denied');
        setShowPermissionDialog(true);
      } else {
        setPermissionState('denied');
        setShowPermissionDialog(true);
      }
    }
  }, []);

  const checkCameraPermission = useCallback(async () => {
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermissionState(result.state as 'prompt' | 'denied' | 'granted');

        if (result.state === 'granted') {
          startCamera();
        } else if (result.state === 'prompt') {
          setShowPermissionDialog(true);
        } else if (result.state === 'denied') {
          setShowPermissionDialog(true);
        }

        result.addEventListener('change', () => {
          setPermissionState(result.state as 'prompt' | 'denied' | 'granted');
          if (result.state === 'granted') {
            setShowPermissionDialog(false);
            startCamera();
          }
        });
      } catch {
        // Fallback - try to start camera directly
        startCamera();
      }
    } else {
      startCamera();
    }
  }, [startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (analysisRef.current) {
      cancelAnimationFrame(analysisRef.current);
    }
    setIsScanning(false);
  }, []);

  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const sampleRadius = 100;

    const imageData = ctx.getImageData(
      centerX - sampleRadius,
      centerY - sampleRadius,
      sampleRadius * 2,
      sampleRadius * 2
    );

    const analysis = analyzeColors(imageData);

    if (analysis.isBadgeDetected) {
      try {
        const response = await fetch('/api/verify/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colorSignature: analysis.colorSignature,
            timestamp: Date.now(),
          }),
        });

        const result = await response.json();

        if (result.verified) {
          stopCamera();
          onResult(true, result.zoneName);
          return;
        }
      } catch {
        // Continue scanning
      }
    }

    analysisRef.current = requestAnimationFrame(analyzeFrame);
  }, [isScanning, onResult, stopCamera]);

  useEffect(() => {
    checkCameraPermission();
    return () => stopCamera();
  }, [checkCameraPermission, stopCamera]);

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        analyzeFrame();
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isScanning, analyzeFrame]);

  const handleManualCheck = async () => {
    stopCamera();
    onResult(false);
  };

  if (showPermissionDialog) {
    return (
      <div className="fixed inset-0 min-h-[100dvh] bg-[#fafaf9] flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
          <div className="max-w-lg mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />
              </div>
              <span className="text-sm sm:text-[15px] font-semibold text-neutral-900 tracking-tight">TrustCircle</span>
            </div>
            <button
              onClick={onCancel}
              className="text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center">
            {/* Camera Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              {permissionState === 'denied' ? 'Camera Access Blocked' : 'Enable Camera'}
            </h2>

            <p className="text-neutral-500 mb-6">
              {permissionState === 'denied'
                ? 'TrustCircle needs camera access to scan and verify badges. Camera is blocked in your browser settings.'
                : 'TrustCircle needs camera access to scan and verify neighborhood badges.'}
            </p>

            {permissionState === 'denied' ? (
              <>
                {/* Instructions for enabling camera */}
                <div className="bg-neutral-100 rounded-2xl p-4 mb-6 text-left">
                  <p className="text-sm font-medium text-neutral-700 mb-3">To enable camera access:</p>
                  <ol className="text-sm text-neutral-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">1</span>
                      <span>Click the <strong>lock icon</strong> or <strong>camera icon</strong> in your browser&apos;s address bar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">2</span>
                      <span>Find <strong>Camera</strong> in the permissions list</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">3</span>
                      <span>Change from <strong>Block</strong> to <strong>Allow</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-medium">4</span>
                      <span>Refresh this page</span>
                    </li>
                  </ol>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 transition-colors mb-3"
                >
                  Refresh Page
                </button>
                <button
                  onClick={onCancel}
                  className="w-full px-6 py-3 text-neutral-500 text-sm font-medium hover:text-neutral-900 transition-colors"
                >
                  Go Back
                </button>
              </>
            ) : (
              <>
                {/* Privacy assurance */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-emerald-900">Your privacy is protected</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Camera is only used to scan badges. No photos or videos are stored.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startCamera}
                  className="w-full px-6 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-full hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  Enable Camera Access
                </button>
                <button
                  onClick={onCancel}
                  className="w-full px-6 py-3 text-neutral-500 text-sm font-medium hover:text-neutral-900 transition-colors"
                >
                  Go Back
                </button>
              </>
            )}

            <p className="text-xs text-neutral-400 mt-4">
              Camera is required to verify neighborhood badges
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Video Feed */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Scanning Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Darkened corners */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Clear scanning area */}
          <div className="relative z-10">
            {/* Outer ring */}
            <div className="w-72 h-72 rounded-full border-4 border-white/30 flex items-center justify-center">
              {/* Animated scanning ring */}
              <div className="absolute w-72 h-72 rounded-full border-4 border-transparent border-t-[#4A90D9] animate-spin" style={{ animationDuration: '2s' }} />

              {/* Inner target */}
              <div className="w-56 h-56 rounded-full border-2 border-white/20 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full border border-dashed border-white/30 animate-pulse" />
              </div>
            </div>

            {/* Corner markers */}
            <div className="absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-[#4A90D9] rounded-tl-2xl" />
            <div className="absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-[#4A90D9] rounded-tr-2xl" />
            <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-[#4A90D9] rounded-bl-2xl" />
            <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-[#4A90D9] rounded-br-2xl" />
          </div>
        </div>

        {/* Top Instructions */}
        <div className="absolute top-0 left-0 right-0 pt-safe">
          <div className="p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">TrustCircle Scanner</p>
                <p className="text-white/60 text-sm">Point at a badge to verify</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scanning indicator */}
        {isScanning && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-44">
            <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4A90D9] animate-pulse" />
              <span className="text-white text-sm font-medium">Scanning...</span>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 pb-safe">
          <div className="p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex gap-4 max-w-lg mx-auto">
              <button
                onClick={onCancel}
                className="flex-1 py-4 bg-white/10 backdrop-blur-sm text-white rounded-2xl font-semibold hover:bg-white/20 transition-colors border border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleManualCheck}
                className="flex-1 py-4 bg-[#E74C3C] text-white rounded-2xl font-semibold hover:bg-[#c0392b] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Not Recognized
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function analyzeColors(imageData: ImageData): {
  isBadgeDetected: boolean;
  colorSignature: number[];
} {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const colorBuckets: { [key: string]: number } = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.floor(data[i] / 32) * 32;
    const g = Math.floor(data[i + 1] / 32) * 32;
    const b = Math.floor(data[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;
    colorBuckets[key] = (colorBuckets[key] || 0) + 1;
  }

  const sortedColors = Object.entries(colorBuckets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const dominantColors = sortedColors.map(([color]) =>
    color.split(',').map(Number)
  );

  const hasPrimaryBlue = dominantColors.some(([r, g, b]) =>
    b > r && b > g && b > 100
  );

  const hasGreen = dominantColors.some(([r, g, b]) =>
    g > r && g > b && g > 100
  );

  const hasOrangeYellow = dominantColors.some(([r, g, b]) =>
    r > 150 && g > 100 && b < 100
  );

  const hasStructuredPattern = dominantColors.length >= 3;

  const centerPixels: number[] = [];
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let y = cy - 10; y < cy + 10; y++) {
    for (let x = cx - 10; x < cx + 10; x++) {
      const i = (y * width + x) * 4;
      centerPixels.push(data[i], data[i + 1], data[i + 2]);
    }
  }

  const isBadgeDetected = (hasPrimaryBlue || hasOrangeYellow || hasGreen) && hasStructuredPattern;

  const colorSignature = dominantColors.flat();

  return { isBadgeDetected, colorSignature };
}
