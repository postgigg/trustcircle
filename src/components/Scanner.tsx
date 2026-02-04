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
  const [cameraError, setCameraError] = useState<'denied' | 'notfound' | 'notsecure' | 'error' | null>(null);
  const analysisRef = useRef<number>(0);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    // Check if mediaDevices API is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('notsecure');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('denied');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('notfound');
        } else {
          setCameraError('error');
        }
      } else {
        setCameraError('error');
      }
    }
  }, []);

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

  // Start camera immediately on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

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

  const handleRetry = () => {
    setCameraError(null);
    startCamera();
  };

  // Show error screen if camera access failed
  if (cameraError) {
    return (
      <div className="fixed inset-0 min-h-[100dvh] bg-[#fafaf9] flex flex-col">
        <header className="flex-shrink-0 border-b border-neutral-200 bg-[#fafaf9]/80 backdrop-blur-sm">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <span className="text-sm font-semibold text-neutral-900">TrustCircle</span>
            </div>
            <button onClick={onCancel} className="text-neutral-500 hover:text-neutral-900" aria-label="Close">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-neutral-900 mb-2">
              {cameraError === 'denied' && 'Camera Access Denied'}
              {cameraError === 'notfound' && 'No Camera Found'}
              {cameraError === 'notsecure' && 'Secure Connection Required'}
              {cameraError === 'error' && 'Camera Error'}
            </h2>

            <p className="text-neutral-500 mb-6">
              {cameraError === 'denied' && 'Allow camera access in your browser or device settings, then tap Try Again.'}
              {cameraError === 'notfound' && 'No camera was found on this device.'}
              {cameraError === 'notsecure' && 'Camera access requires a secure (HTTPS) connection. Please access this site via HTTPS.'}
              {cameraError === 'error' && 'Something went wrong accessing the camera.'}
            </p>

            {cameraError === 'denied' && (
              <div className="bg-neutral-100 rounded-xl p-4 mb-6 text-left text-sm text-neutral-600">
                <p className="font-medium text-neutral-900 mb-2">On iPhone Safari:</p>
                <p>Settings → Safari → Camera → Allow</p>
                <p className="mt-2 text-xs text-neutral-500">Then come back and tap Try Again</p>
              </div>
            )}

            {cameraError === 'notsecure' && (
              <div className="bg-neutral-100 rounded-xl p-4 mb-6 text-left text-sm text-neutral-600">
                <p className="font-medium text-neutral-900 mb-2">Why this happens:</p>
                <p>Browsers only allow camera access on secure (HTTPS) pages to protect your privacy.</p>
              </div>
            )}

            <button
              onClick={handleRetry}
              className="w-full py-3 bg-neutral-900 text-white font-semibold rounded-full hover:bg-neutral-800 transition-colors mb-3"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 text-neutral-500 font-medium hover:text-neutral-900 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
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
          <div className="absolute inset-0 bg-black/40" />

          <div className="relative z-10">
            <div className="w-72 h-72 rounded-full border-4 border-white/30 flex items-center justify-center">
              <div className="absolute w-72 h-72 rounded-full border-4 border-transparent border-t-[#4A90D9] animate-spin" style={{ animationDuration: '2s' }} />
              <div className="w-56 h-56 rounded-full border-2 border-white/20 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full border border-dashed border-white/30 animate-pulse" />
              </div>
            </div>

            <div className="absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-[#4A90D9] rounded-tl-2xl" />
            <div className="absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-[#4A90D9] rounded-tr-2xl" />
            <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-[#4A90D9] rounded-bl-2xl" />
            <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-[#4A90D9] rounded-br-2xl" />
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 pt-safe">
          <div className="p-6 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">Scan Badge</p>
                <p className="text-white/60 text-sm">Point at a TrustCircle badge</p>
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

        {/* Bottom buttons */}
        <div className="absolute bottom-0 left-0 right-0 pb-safe">
          <div className="p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex gap-4 max-w-lg mx-auto">
              <button
                onClick={onCancel}
                className="flex-1 py-4 bg-white/10 backdrop-blur-sm text-white rounded-2xl font-semibold border border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleManualCheck}
                className="flex-1 py-4 bg-[#E74C3C] text-white rounded-2xl font-semibold flex items-center justify-center gap-2"
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
