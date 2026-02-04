'use client';

import { useEffect, useRef, useState } from 'react';

interface DemoBadgeProps {
  size?: number;
  pattern?: 'wave' | 'pulse' | 'ripple' | 'spiral';
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * A standalone demo badge that shows the live animated badge pattern
 * without requiring zone data. Used on the landing page.
 */
export default function DemoBadge({
  size = 200,
  pattern = 'wave',
  primaryColor = '#1B365D',
  secondaryColor = '#4A90D9',
}: DemoBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = size * 1.2; // Slightly larger for better quality
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const center = canvasSize / 2;
    const radius = (canvasSize / 2) - 4;

    const animate = (timestamp: number) => {
      const time = timestamp * 0.001;

      ctx.clearRect(0, 0, canvasSize, canvasSize);

      switch (pattern) {
        case 'wave':
          drawWavePattern(ctx, center, radius, time, primaryColor, secondaryColor);
          break;
        case 'pulse':
          drawPulsePattern(ctx, center, radius, time, primaryColor, secondaryColor);
          break;
        case 'ripple':
          drawRipplePattern(ctx, center, radius, time, primaryColor, secondaryColor);
          break;
        case 'spiral':
          drawSpiralPattern(ctx, center, radius, time, primaryColor, secondaryColor);
          break;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, pattern, primaryColor, secondaryColor]);

  return (
    <div className="flex flex-col items-center">
      {/* Badge Container with subtle outer ring */}
      <div className="relative">
        <div className="absolute -inset-3 rounded-full border border-neutral-200/50" />
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="rounded-full"
        />
      </div>

      {/* Info below badge */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-neutral-600">Verified</span>
        </div>
        <p className="mt-2 text-sm font-mono text-neutral-400 tabular-nums">
          {currentTime}
        </p>
      </div>
    </div>
  );
}

function drawWavePattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, center * 2, center * 2);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, secondary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Flowing waves
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + i * 0.05})`;
    ctx.lineWidth = 2;

    for (let x = 0; x < center * 2; x += 2) {
      const y = center + Math.sin((x + time * 50 + i * 45) * 0.018) * (20 + i * 12);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawPulsePattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Solid background
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Expanding rings
  for (let i = 0; i < 3; i++) {
    const pulseRadius = ((time * 25 + i * 60) % (radius * 1.2));
    const alpha = Math.max(0, (1 - pulseRadius / radius) * 0.2);

    ctx.beginPath();
    ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Center dot
  const innerPulse = (Math.sin(time * 0.8) + 1) * 0.5;
  ctx.beginPath();
  ctx.arc(center, center, 8 + innerPulse * 4, 0, Math.PI * 2);
  ctx.fillStyle = secondary;
  ctx.fill();

  ctx.restore();
}

function drawRipplePattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Radial gradient background
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, secondary);
  gradient.addColorStop(1, primary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Concentric ripples
  for (let i = 0; i < 5; i++) {
    const rippleRadius = 15 + ((time * 30 + i * 35) % (radius - 15));
    const alpha = (1 - rippleRadius / radius) * 0.15;

    ctx.beginPath();
    ctx.arc(center, center, rippleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

function drawSpiralPattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Solid background
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Spiral arms
  const arms = 3;
  for (let arm = 0; arm < arms; arm++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,0.18)`;
    ctx.lineWidth = 2;

    const armOffset = (arm / arms) * Math.PI * 2;

    for (let i = 0; i < 150; i++) {
      const angle = i * 0.08 + time * 0.4 + armOffset;
      const r = i * 0.7;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;

      if (r > radius - 5) break;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // Center
  ctx.beginPath();
  ctx.arc(center, center, 6, 0, Math.PI * 2);
  ctx.fillStyle = secondary;
  ctx.fill();

  ctx.restore();
}
