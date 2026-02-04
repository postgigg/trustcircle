'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getBadgeDetector } from '@/lib/badgeDetector';

interface ScannerProps {
  onResult: (success: boolean, zoneName?: string) => void;
  onCancel: () => void;
}

export default function Scanner({ onResult, onCancel }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<ReturnType<typeof getBadgeDetector> | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState('Starting camera...');
  const [confidence, setConfidence] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const animationRef = useRef<number>(0);
  const verifyingRef = useRef(false);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not available. Use HTTPS.');
      return;
    }

    try {
      // Try back camera first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        // Fallback to any camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        detectorRef.current = getBadgeDetector();
        detectorRef.current.reset();
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Allow camera in settings.');
      } else {
        setCameraError('Could not access camera.');
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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

  // Detection loop - runs at ~10fps for stability
  useEffect(() => {
    if (!isScanning || !detectorRef.current) return;

    let lastTime = 0;
    const targetInterval = 100; // 10fps

    const detect = async (timestamp: number) => {
      if (timestamp - lastTime < targetInterval) {
        animationRef.current = requestAnimationFrame(detect);
        return;
      }
      lastTime = timestamp;

      if (!videoRef.current || !detectorRef.current || verifyingRef.current) {
        animationRef.current = requestAnimationFrame(detect);
        return;
      }

      const result = detectorRef.current.detectBadge(videoRef.current);
      setGuidance(result.guidance);
      setConfidence(result.confidence);
      setIsReady(result.ready);

      // Auto-verify when ready
      if (result.ready && !verifyingRef.current) {
        verifyingRef.current = true;
        await verifyBadge();
        return;
      }

      animationRef.current = requestAnimationFrame(detect);
    };

    animationRef.current = requestAnimationFrame(detect);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isScanning]);

  const verifyBadge = async () => {
    if (!videoRef.current || !detectorRef.current) {
      verifyingRef.current = false;
      return;
    }

    setGuidance('Verifying...');

    try {
      const colorSignature = detectorRef.current.extractColorSignature(videoRef.current);

      // If not enough badge colors found, keep scanning
      if (colorSignature.length === 0) {
        verifyingRef.current = false;
        if (detectorRef.current) detectorRef.current.reset();
        setGuidance('Badge not clear - try again');
        return;
      }

      const response = await fetch('/api/verify/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colorSignature, timestamp: Date.now() }),
      });

      const result = await response.json();

      if (result.verified) {
        stopCamera();
        onResult(true, result.zoneName);
        return;
      }
    } catch (err) {
      console.error('Verify error:', err);
    }

    // Reset and continue scanning
    verifyingRef.current = false;
    if (detectorRef.current) detectorRef.current.reset();
    setGuidance('Not recognized - try again');
  };

  const handleNotRecognized = () => {
    stopCamera();
    onResult(false);
  };

  // Error screen
  if (cameraError) {
    return (
      <div className="fixed inset-0 bg-[#fafaf9] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Camera Error</h2>
            <p className="text-neutral-500 mb-6">{cameraError}</p>
            <button
              onClick={() => { setCameraError(null); startCamera(); }}
              className="w-full py-3 bg-neutral-900 text-white font-semibold rounded-full mb-3"
            >
              Try Again
            </button>
            <button onClick={onCancel} className="w-full py-3 text-neutral-500">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Dark gradient top/bottom */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Center target */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-56 h-56 rounded-full border-4 transition-colors duration-200 ${
            isReady ? 'border-green-400' : confidence > 0.3 ? 'border-blue-400' : 'border-white/40'
          }`}>
            {/* Spinning indicator when detecting */}
            {confidence > 0.2 && !isReady && (
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
            )}
            {/* Checkmark when ready */}
            {isReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-20 h-20 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top guidance */}
      <div className="absolute top-0 inset-x-0 pt-safe">
        <div className="p-6">
          <div className={`mx-auto w-fit px-5 py-2.5 rounded-full backdrop-blur-md transition-colors ${
            isReady ? 'bg-green-500/90' : confidence > 0.3 ? 'bg-blue-500/90' : 'bg-black/50'
          }`}>
            <p className="text-white font-semibold text-center">{guidance}</p>
          </div>

          {/* Confidence bar */}
          {confidence > 0 && (
            <div className="mt-3 mx-auto w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${isReady ? 'bg-green-400' : 'bg-blue-400'}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="absolute bottom-0 inset-x-0 pb-safe pointer-events-auto">
        <div className="p-6">
          <div className="flex gap-4 max-w-md mx-auto">
            <button
              onClick={onCancel}
              className="flex-1 py-4 bg-white/20 backdrop-blur-sm text-white rounded-2xl font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleNotRecognized}
              className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-semibold"
            >
              Not Recognized
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
