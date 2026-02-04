'use client';

import { useEffect, useRef, useState } from 'react';

interface BadgeScannerProps {
  onScanSuccess: (seed: string) => void;
  onClose: () => void;
  scanning: boolean;
}

export default function BadgeScanner({ onScanSuccess, onClose, scanning }: BadgeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanForBadge();
        }
      } catch (err) {
        console.error('Camera error:', err);
        setError('Camera access required to scan badges');
        setHasCamera(false);
      }
    };

    const scanForBadge = () => {
      if (!videoRef.current || !canvasRef.current || !scanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.videoWidth === 0) {
        animationFrame = requestAnimationFrame(scanForBadge);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // For now, we'll use a simple color detection approach
      // In production, you'd want more sophisticated badge detection
      // The badge has animated colors that we can try to detect

      // Check if there's a QR code in the frame using a library
      // For simplicity, we'll prompt manual seed entry as fallback

      animationFrame = requestAnimationFrame(scanForBadge);
    };

    if (scanning) {
      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [scanning, onScanSuccess]);

  // Manual seed entry as a fallback
  const [manualSeed, setManualSeed] = useState('');

  const handleManualSubmit = () => {
    if (manualSeed.trim()) {
      onScanSuccess(manualSeed.trim());
    }
  };

  if (!hasCamera) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">Camera Not Available</h3>
          <p className="text-neutral-500 text-sm mb-4">
            Ask the verified resident to read their badge code to you:
          </p>
          <input
            type="text"
            value={manualSeed}
            onChange={(e) => setManualSeed(e.target.value)}
            placeholder="Enter badge code..."
            className="w-full px-4 py-3 border border-neutral-200 rounded-xl text-neutral-900 mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-neutral-200 rounded-xl text-neutral-600 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleManualSubmit}
              className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-xl font-medium"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-white font-medium">Scan a Badge</span>
          <div className="w-10" />
        </div>
      </div>

      {/* Camera View */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 border-2 border-white/50 rounded-3xl" />
      </div>

      {/* Instructions */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white text-center mb-4">
          Point your camera at a verified resident&apos;s live badge
        </p>

        {/* Manual entry option */}
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-white/70 text-sm text-center mb-3">
            Or enter the badge code manually:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualSeed}
              onChange={(e) => setManualSeed(e.target.value)}
              placeholder="Badge code..."
              className="flex-1 px-4 py-2 bg-white/20 rounded-lg text-white placeholder:text-white/50 text-sm"
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualSeed.trim()}
              className="px-4 py-2 bg-white text-neutral-900 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-center mt-4 text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
