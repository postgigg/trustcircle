'use client';

import { ReactNode } from 'react';

interface PhoneMockupProps {
  children: ReactNode;
  tiltDirection?: 'left' | 'right';
}

export default function PhoneMockup({
  children,
  tiltDirection = 'left',
}: PhoneMockupProps) {
  const tiltStyle = tiltDirection === 'left'
    ? { transform: 'perspective(1000px) rotateY(-15deg) rotateX(5deg) rotateZ(2deg)' }
    : { transform: 'perspective(1000px) rotateY(15deg) rotateX(5deg) rotateZ(-2deg)' };

  return (
    <div
      className="relative w-[280px] lg:w-[300px]"
      style={{
        ...tiltStyle,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Phone shadow */}
      <div
        className="absolute inset-0 bg-neutral-900/15 rounded-[2.5rem] blur-xl"
        style={{
          transform: 'translateZ(-30px) translateX(15px) translateY(15px)',
        }}
      />

      {/* Phone body - proper iPhone aspect ratio */}
      <div
        className="relative bg-neutral-900 rounded-[2.5rem] p-2"
        style={{
          boxShadow: `
            inset 0 0 0 1px rgba(255,255,255,0.1),
            0 0 0 1px rgba(0,0,0,0.1),
            0 20px 40px -10px rgba(0,0,0,0.3)
          `,
        }}
      >
        {/* Side buttons - left */}
        <div className="absolute -left-[2px] top-24 w-[2px] h-6 bg-neutral-700 rounded-l-sm" />
        <div className="absolute -left-[2px] top-32 w-[2px] h-10 bg-neutral-700 rounded-l-sm" />
        <div className="absolute -left-[2px] top-44 w-[2px] h-10 bg-neutral-700 rounded-l-sm" />

        {/* Side button - right */}
        <div className="absolute -right-[2px] top-28 w-[2px] h-14 bg-neutral-700 rounded-r-sm" />

        {/* Screen bezel */}
        <div className="relative bg-black rounded-[2rem] overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20">
            <div className="w-24 h-6 bg-black rounded-full flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-neutral-800 ring-1 ring-neutral-700" />
            </div>
          </div>

          {/* Screen content - proper tall aspect ratio */}
          <div className="relative bg-[#fafaf9]" style={{ minHeight: '580px' }}>
            {/* Status bar */}
            <div className="flex items-center justify-between px-6 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-neutral-900">9:41</span>
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-neutral-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                </svg>
                <div className="flex items-center">
                  <div className="w-5 h-2.5 border border-neutral-900 rounded-sm relative">
                    <div className="absolute inset-0.5 right-0.5 bg-neutral-900 rounded-sm" />
                  </div>
                  <div className="w-0.5 h-1 bg-neutral-900 rounded-r-sm" />
                </div>
              </div>
            </div>

            {/* App content */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
              {children}
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <div className="w-28 h-1 bg-neutral-900/80 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
