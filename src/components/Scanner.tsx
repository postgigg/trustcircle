'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getBadgeDetector } from '@/lib/badgeDetector';

interface ScannerProps {
  onResult: (success: boolean, zoneName?: string) => void;
  onCancel: () => void;
}

interface DetectionState {
  detected: boolean;
  centered: boolean;
  tooFar: boolean;
  tooClose: boolean;
  blurry: boolean;
  guidance: string;
  confidence: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export default function Scanner({ onResult, onCancel }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<ReturnType<typeof getBadgeDetector> | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<'denied' | 'notfound' | 'notsecure' | 'error' | null>(null);
  const [detection, setDetection] = useState<DetectionState>({
    detected: false,
    centered: false,
    tooFar: false,
    tooClose: false,
    blurry: false,
    guidance: 'Initializing...',
    confidence: 0,
  });
  const [readyFrames, setReadyFrames] = useState(0);
  const animationRef = useRef<number>(0);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('notsecure');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);

        // Initialize detector
        detectorRef.current = getBadgeDetector();
      }
    } catch (err) {
      // Try again without exact facingMode
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
          detectorRef.current = getBadgeDetector();
        }
      } catch (err2) {
        console.error('Camera error:', err2);
        if (err2 instanceof Error) {
          if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
            setCameraError('denied');
          } else if (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError') {
            setCameraError('notfound');
          } else {
            setCameraError('error');
          }
        } else {
          setCameraError('error');
        }
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Real-time detection loop
  useEffect(() => {
    if (!isScanning || !detectorRef.current) return;

    let frameCount = 0;

    const detectFrame = async () => {
      if (!videoRef.current || !detectorRef.current) return;

      const result = detectorRef.current.detectBadge(videoRef.current);
      setDetection(result);

      // Draw overlay
      if (overlayRef.current && videoRef.current) {
        const overlay = overlayRef.current;
        const video = videoRef.current;
        overlay.width = video.clientWidth;
        overlay.height = video.clientHeight;
        const ctx = overlay.getContext('2d');

        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);

          if (result.boundingBox) {
            // Scale bounding box to overlay size
            const scaleX = overlay.width / video.videoWidth;
            const scaleY = overlay.height / video.videoHeight;

            const x = result.boundingBox.x * scaleX;
            const y = result.boundingBox.y * scaleY;
            const w = result.boundingBox.width * scaleX;
            const h = result.boundingBox.height * scaleY;

            // Draw detection box
            ctx.strokeStyle = result.centered && !result.blurry ? '#2ECC71' : '#4A90D9';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.strokeRect(x, y, w, h);

            // Draw corner brackets
            const bracketSize = 20;
            ctx.setLineDash([]);
            ctx.lineWidth = 4;
            ctx.strokeStyle = result.centered && !result.blurry ? '#2ECC71' : '#4A90D9';

            // Top-left
            ctx.beginPath();
            ctx.moveTo(x, y + bracketSize);
            ctx.lineTo(x, y);
            ctx.lineTo(x + bracketSize, y);
            ctx.stroke();

            // Top-right
            ctx.beginPath();
            ctx.moveTo(x + w - bracketSize, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + bracketSize);
            ctx.stroke();

            // Bottom-left
            ctx.beginPath();
            ctx.moveTo(x, y + h - bracketSize);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + bracketSize, y + h);
            ctx.stroke();

            // Bottom-right
            ctx.beginPath();
            ctx.moveTo(x + w - bracketSize, y + h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w, y + h - bracketSize);
            ctx.stroke();
          }
        }
      }

      // Check if ready to verify (badge centered, not blurry, for several frames)
      if (result.detected && result.centered && !result.blurry && !result.tooFar && !result.tooClose) {
        frameCount++;
        setReadyFrames(frameCount);

        if (frameCount >= 15) {
          // Auto-verify after holding steady
          await verifyBadge();
          return;
        }
      } else {
        frameCount = 0;
        setReadyFrames(0);
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    };

    animationRef.current = requestAnimationFrame(detectFrame);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning]);

  const verifyBadge = async () => {
    if (!videoRef.current || !detectorRef.current) return;

    const colorSignature = detectorRef.current.extractColorSignature(videoRef.current);

    try {
      const response = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colorSignature,
          timestamp: Date.now(),
        }),
      });

      const result = await response.json();

      if (result.verified) {
        stopCamera();
        onResult(true, result.zoneName);
      } else {
        // Keep scanning
        setReadyFrames(0);
      }
    } catch {
      // Keep scanning on error
      setReadyFrames(0);
    }
  };

  const handleManualCheck = async () => {
    stopCamera();
    onResult(false);
  };

  const handleRetry = () => {
    setCameraError(null);
    startCamera();
  };

  // Error screen
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
              {cameraError === 'notsecure' && 'Camera access requires a secure (HTTPS) connection.'}
              {cameraError === 'error' && 'Something went wrong accessing the camera.'}
            </p>

            {cameraError === 'denied' && (
              <div className="bg-neutral-100 rounded-xl p-4 mb-6 text-left text-sm text-neutral-600">
                <p className="font-medium text-neutral-900 mb-2">On iPhone Safari:</p>
                <p>Settings → Safari → Camera → Allow</p>
                <p className="mt-2 text-xs text-neutral-500">Then come back and tap Try Again</p>
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

  // Progress bar percentage
  const progressPercent = Math.min(100, (readyFrames / 15) * 100);

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

        {/* Detection overlay canvas */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark edges */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
        </div>

        {/* Center target circle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-64 h-64 rounded-full border-4 transition-colors duration-300 ${
            detection.detected && detection.centered && !detection.blurry
              ? 'border-[#2ECC71]'
              : detection.detected
                ? 'border-[#4A90D9]'
                : 'border-white/30'
          }`}>
            {/* Scanning animation */}
            {detection.detected && (
              <div
                className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
                style={{
                  borderTopColor: detection.centered ? '#2ECC71' : '#4A90D9',
                  animationDuration: '1.5s',
                }}
              />
            )}
          </div>
        </div>

        {/* Top bar with guidance */}
        <div className="absolute top-0 left-0 right-0 pt-safe">
          <div className="p-6 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex flex-col items-center">
              <div className={`px-5 py-2.5 rounded-full backdrop-blur-md transition-colors duration-300 ${
                detection.detected && detection.centered && !detection.blurry
                  ? 'bg-[#2ECC71]/90'
                  : detection.detected
                    ? 'bg-[#4A90D9]/90'
                    : 'bg-white/20'
              }`}>
                <p className="text-white font-semibold text-center">
                  {detection.guidance}
                </p>
              </div>

              {/* Confidence indicator */}
              {detection.detected && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-300"
                      style={{ width: `${detection.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-white/60 text-xs">
                    {Math.round(detection.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar when ready */}
        {readyFrames > 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-40">
            <div className="bg-black/70 backdrop-blur-md rounded-2xl px-6 py-4 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#2ECC71] animate-pulse" />
                <span className="text-white font-medium">Hold steady...</span>
              </div>
              <div className="h-2 w-40 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2ECC71] rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Direction indicators */}
        {detection.detected && !detection.centered && (
          <>
            {detection.guidance === 'Move left' && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 animate-pulse">
                <svg className="w-12 h-12 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            )}
            {detection.guidance === 'Move right' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-pulse">
                <svg className="w-12 h-12 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
            {detection.guidance === 'Move up' && (
              <div className="absolute top-28 left-1/2 -translate-x-1/2 animate-pulse">
                <svg className="w-12 h-12 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </div>
            )}
            {detection.guidance === 'Move down' && (
              <div className="absolute bottom-40 left-1/2 -translate-x-1/2 animate-pulse">
                <svg className="w-12 h-12 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </>
        )}

        {/* Distance indicators */}
        {detection.tooFar && (
          <div className="absolute bottom-48 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="bg-[#4A90D9]/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <span className="text-white font-medium">Move closer</span>
            </div>
          </div>
        )}

        {detection.tooClose && (
          <div className="absolute bottom-48 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="bg-[#4A90D9]/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
              <span className="text-white font-medium">Move back</span>
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
