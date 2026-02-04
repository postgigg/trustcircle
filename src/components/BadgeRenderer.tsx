'use client';

import { useEffect, useRef, useState } from 'react';
import type { Zone, DeviceStatus } from '@/types';
import { extractSeedParameters } from '@/lib/crypto';
import { getPatternMultiplier, PATTERN_CONFIG } from '@/lib/patternEncoder';

interface BadgeRendererProps {
  zone: Zone;
  seed: string;
  status: DeviceStatus;
  isSubsidized?: boolean;
  microVariation?: number;
  showTimestamp?: boolean;
  /** 24-bit pattern for invisible device verification (brightness modulation) */
  pattern?: boolean[];
}

export default function BadgeRenderer({
  zone,
  seed,
  status,
  isSubsidized = false,
  microVariation = 0,
  showTimestamp = true,
  pattern,
}: BadgeRendererProps) {
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

    const size = canvas.width;
    const center = size / 2;
    const radius = (size / 2) - 4;

    const params = extractSeedParameters(seed);
    const { phaseOffset, speedMultiplier, colorIntensity, motionModifier } = params;

    const primaryColor = status === 'verifying' ? '#a3a3a3' : (zone.color_primary || '#1B365D');
    const secondaryColor = status === 'verifying' ? '#d4d4d4' : (zone.color_secondary || '#4A90D9');

    const animate = (timestamp: number) => {
      const time = timestamp * 0.001 * speedMultiplier + phaseOffset * 1000 + microVariation * 100;

      // Calculate brightness multiplier for invisible verification pattern
      const brightnessMultiplier = pattern && pattern.length === PATTERN_CONFIG.BITS_TOTAL
        ? getPatternMultiplier(pattern, timestamp)
        : 1.0;

      ctx.clearRect(0, 0, size, size);

      if (status === 'inactive' || status === 'frozen') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f5f5f5';
        ctx.fill();
        ctx.restore();
      } else if (status === 'revoked') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fef2f2';
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      } else {
        const motionPattern = zone.motion_pattern || 'wave';
        switch (motionPattern) {
          case 'wave':
            drawWavePattern(ctx, center, radius, time, primaryColor, secondaryColor, colorIntensity, brightnessMultiplier);
            break;
          case 'pulse':
            drawPulsePattern(ctx, center, radius, time, primaryColor, secondaryColor, colorIntensity, brightnessMultiplier);
            break;
          case 'ripple':
            drawRipplePattern(ctx, center, radius, time, primaryColor, secondaryColor, colorIntensity, brightnessMultiplier);
            break;
          case 'spiral':
            drawSpiralPattern(ctx, center, radius, time, primaryColor, secondaryColor, colorIntensity, motionModifier, brightnessMultiplier);
            break;
          default:
            drawWavePattern(ctx, center, radius, time, primaryColor, secondaryColor, colorIntensity, brightnessMultiplier);
        }
      }

      // Subsidized ring
      if (isSubsidized && status === 'active') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius - 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [zone, seed, status, isSubsidized, microVariation, pattern]);

  const getStatusLabel = () => {
    switch (status) {
      case 'active': return 'Verified';
      case 'verifying': return 'Verifying';
      case 'inactive': return 'Inactive';
      case 'revoked': return 'Revoked';
      case 'frozen': return 'Frozen';
      default: return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'active': return 'bg-emerald-500';
      case 'verifying': return 'bg-amber-500';
      case 'inactive': return 'bg-neutral-400';
      case 'revoked': return 'bg-red-500';
      case 'frozen': return 'bg-neutral-400';
      default: return 'bg-neutral-400';
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Badge Container */}
      <div className="relative">
        {/* Outer ring for active status */}
        {status === 'active' && (
          <div className="absolute -inset-3 rounded-full border border-neutral-200" />
        )}

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          className="rounded-full"
        />
      </div>

      {/* Info below badge */}
      <div className="mt-4 text-center">
        {/* Status pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full">
          <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
          <span className="text-xs font-medium text-neutral-600">{getStatusLabel()}</span>
        </div>

        {/* Timestamp */}
        {showTimestamp && (
          <p className="mt-2 text-sm font-mono text-neutral-400 tabular-nums">
            {currentTime}
          </p>
        )}

        {/* Subsidized badge */}
        {isSubsidized && status === 'active' && (
          <p className="mt-2 text-xs text-amber-600 font-medium">Community Sponsored</p>
        )}
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
  secondary: string,
  intensity: number,
  brightnessMultiplier: number = 1.0
) {
  const t = isFinite(time) ? time : 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Apply brightness multiplier via global alpha and filter
  ctx.filter = `brightness(${brightnessMultiplier})`;

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, center * 2, center * 2);
  gradient.addColorStop(0, primary);
  gradient.addColorStop(1, secondary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Flowing waves
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + (i * 0.05) * intensity})`;
    ctx.lineWidth = 2;

    for (let x = 0; x < center * 2; x += 2) {
      const y = center + Math.sin((x + t * 50 + i * 45) * 0.018) * (20 + i * 12);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawPulsePattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string,
  intensity: number,
  brightnessMultiplier: number = 1.0
) {
  const t = isFinite(time) ? time : 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Apply brightness multiplier
  ctx.filter = `brightness(${brightnessMultiplier})`;

  // Solid background
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Expanding rings
  for (let i = 0; i < 3; i++) {
    const pulseRadius = ((t * 25 + i * 60) % (radius * 1.2));
    const alpha = Math.max(0, (1 - pulseRadius / radius) * 0.15 * intensity);

    ctx.beginPath();
    ctx.arc(center, center, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Center dot
  const innerPulse = (Math.sin(t * 0.8) + 1) * 0.5;
  ctx.beginPath();
  ctx.arc(center, center, 8 + innerPulse * 4, 0, Math.PI * 2);
  ctx.fillStyle = secondary;
  ctx.fill();

  ctx.filter = 'none';
  ctx.restore();
}

function drawRipplePattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string,
  intensity: number,
  brightnessMultiplier: number = 1.0
) {
  const t = isFinite(time) ? time : 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Apply brightness multiplier
  ctx.filter = `brightness(${brightnessMultiplier})`;

  // Radial gradient background
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, secondary);
  gradient.addColorStop(1, primary);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Concentric ripples
  for (let i = 0; i < 5; i++) {
    const rippleRadius = 15 + ((t * 30 + i * 35) % (radius - 15));
    const alpha = (1 - rippleRadius / radius) * 0.12 * intensity;

    ctx.beginPath();
    ctx.arc(center, center, rippleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.filter = 'none';
  ctx.restore();
}

function drawSpiralPattern(
  ctx: CanvasRenderingContext2D,
  center: number,
  radius: number,
  time: number,
  primary: string,
  secondary: string,
  intensity: number,
  modifier: number,
  brightnessMultiplier: number = 1.0
) {
  const safeTime = isFinite(time) ? time : 0;
  const safeModifier = isFinite(modifier) ? modifier : 0.5;

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  // Apply brightness multiplier
  ctx.filter = `brightness(${brightnessMultiplier})`;

  // Solid background
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, center * 2, center * 2);

  // Spiral arms
  const arms = 2 + Math.floor(safeModifier * 2);
  for (let arm = 0; arm < arms; arm++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${0.15 * intensity})`;
    ctx.lineWidth = 2;

    const armOffset = (arm / arms) * Math.PI * 2;

    for (let i = 0; i < 150; i++) {
      const angle = i * 0.08 + safeTime * 0.4 + armOffset;
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

  ctx.filter = 'none';
  ctx.restore();
}
