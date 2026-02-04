'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  t: number;
}

interface PuzzleSliderProps {
  onComplete: (touchData: { points: TouchPoint[]; duration: number }) => void;
  onCancel?: () => void;
}

export default function PuzzleSlider({ onComplete, onCancel }: PuzzleSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchPoints = useRef<TouchPoint[]>([]);
  const startTime = useRef<number>(0);
  const maxPosition = useRef(0);

  // Calculate max position on mount
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const track = container.querySelector('[data-track]') as HTMLElement;
      const piece = container.querySelector('[data-piece]') as HTMLElement;

      if (track && piece) {
        maxPosition.current = track.clientWidth - piece.clientWidth;
      }
    }
  }, []);

  const recordPoint = useCallback((clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    touchPoints.current.push({
      x: clientX - rect.left,
      y: rect.height / 2, // Center y since we only track horizontal
      t: Date.now(),
    });
  }, []);

  const handleStart = useCallback((clientX: number) => {
    setIsDragging(true);
    touchPoints.current = [];
    startTime.current = Date.now();
    recordPoint(clientX);
  }, [recordPoint]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || !containerRef.current || isComplete) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;

    // Calculate new position (constrained to track)
    const pieceWidth = 56; // Match the piece width
    const trackStart = pieceWidth / 2;
    const newPosition = Math.max(0, Math.min(relativeX - trackStart, maxPosition.current));

    setPosition(newPosition);
    recordPoint(clientX);

    // Check if reached target
    if (newPosition >= maxPosition.current - 10) {
      handleComplete();
    }
  }, [isDragging, isComplete, recordPoint]);

  const handleEnd = useCallback(() => {
    if (!isDragging || isComplete) return;

    setIsDragging(false);

    // If not complete, animate back to start
    if (position < maxPosition.current - 10) {
      setIsAnimating(true);
      setPosition(0);
      setTimeout(() => setIsAnimating(false), 200);
      touchPoints.current = [];
    }
  }, [isDragging, isComplete, position]);

  const handleComplete = useCallback(() => {
    setIsComplete(true);
    setIsDragging(false);
    setPosition(maxPosition.current);

    const duration = Date.now() - startTime.current;

    // Small delay for visual feedback
    setTimeout(() => {
      onComplete({
        points: touchPoints.current,
        duration,
      });
    }, 500);
  }, [onComplete]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleEnd();
  };

  // Mouse handlers (for testing on desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleEnd();
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Instructions */}
      <div className="text-center mb-6">
        <p className="text-neutral-600 text-sm">
          {isComplete ? 'Verified!' : 'Slide to verify you\'re real'}
        </p>
      </div>

      {/* Slider container */}
      <div
        ref={containerRef}
        className="relative h-14 bg-neutral-100 rounded-full overflow-hidden select-none touch-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Track */}
        <div
          data-track
          className="absolute inset-0 flex items-center"
        >
          {/* Progress fill */}
          <div
            className={`absolute left-0 top-0 bottom-0 rounded-full transition-colors ${
              isComplete ? 'bg-emerald-100' : 'bg-blue-100'
            }`}
            style={{
              width: `${position + 56}px`,
              transition: isAnimating ? 'width 200ms ease-out' : 'none',
            }}
          />

          {/* Target zone indicator */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center">
            {isComplete ? (
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>

          {/* Draggable piece */}
          <div
            data-piece
            className={`absolute w-14 h-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-transform ${
              isComplete
                ? 'bg-emerald-500 scale-105'
                : isDragging
                ? 'bg-blue-600 scale-105'
                : 'bg-neutral-900 hover:scale-105'
            }`}
            style={{
              left: `${position}px`,
              transition: isAnimating ? 'left 200ms ease-out' : isDragging ? 'none' : 'transform 150ms ease',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
          >
            {isComplete ? (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>

          {/* Helper text */}
          {!isComplete && position < 20 && (
            <span className="absolute left-20 text-sm text-neutral-400 pointer-events-none">
              Slide right
            </span>
          )}
        </div>
      </div>

      {/* Cancel button */}
      {onCancel && !isComplete && (
        <button
          onClick={onCancel}
          className="w-full mt-4 py-2 text-neutral-500 text-sm hover:text-neutral-700 transition-colors"
        >
          Cancel
        </button>
      )}

      {/* Success feedback */}
      {isComplete && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Verification complete
          </div>
        </div>
      )}
    </div>
  );
}
