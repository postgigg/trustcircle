'use client';

interface VerificationProgressProps {
  nightsConfirmed: number;
  movementDaysConfirmed: number;
  verificationStartDate: string;
  zoneName: string;
}

export default function VerificationProgress({
  nightsConfirmed,
  movementDaysConfirmed,
  verificationStartDate,
  zoneName,
}: VerificationProgressProps) {
  const startDate = new Date(verificationStartDate);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(daysPassed, 14);

  const nightsProgress = (nightsConfirmed / 14) * 100;
  const movementProgress = (movementDaysConfirmed / 10) * 100;

  const circleRadius = 80;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (nightsProgress / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-6">
      {/* Main Progress Circle */}
      <div className="relative w-56 h-56">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F5A623]/20 to-transparent blur-xl" />

        <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={circleRadius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="14"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r={circleRadius}
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F5A623" />
              <stop offset="100%" stopColor="#D4AF37" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#F5A623] to-[#D4AF37] flex items-center justify-center shadow-lg shadow-[#F5A623]/30">
              <div className="text-center">
                <span className="text-white text-4xl font-bold">{currentDay}</span>
                <span className="text-white/80 text-lg">/14</span>
              </div>
            </div>
            {/* Pulse effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F5A623] to-[#D4AF37] animate-ping opacity-20" />
          </div>
          <span className="text-white/60 mt-3 text-sm font-medium">days</span>
        </div>
      </div>

      {/* Zone Name */}
      <div className="text-center mt-6">
        <h2 className="text-2xl font-bold text-white">{zoneName}</h2>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse" />
          <p className="text-[#F5A623] font-semibold">Verifying Your Presence</p>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="w-full max-w-sm mt-8 space-y-6">
        {/* Nights Progress */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white font-medium flex items-center gap-2">
              <svg className="w-4 h-4 text-[#2ECC71]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Nights at home
            </span>
            <span className="text-white/70">{nightsConfirmed} of 14</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#2ECC71] to-[#27ae60] rounded-full transition-all duration-500"
              style={{ width: `${nightsProgress}%` }}
            />
          </div>
          <div className="flex gap-1 mt-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-3 rounded transition-all duration-300 ${
                  i < nightsConfirmed
                    ? 'bg-[#2ECC71] shadow-sm shadow-[#2ECC71]/50'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Movement Progress */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white font-medium flex items-center gap-2">
              <svg className="w-4 h-4 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Movement detected
            </span>
            <span className="text-white/70">{movementDaysConfirmed} of 10</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4A90D9] to-[#357abd] rounded-full transition-all duration-500"
              style={{ width: `${movementProgress}%` }}
            />
          </div>
          <div className="flex gap-1 mt-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-3 rounded transition-all duration-300 ${
                  i < movementDaysConfirmed
                    ? 'bg-[#4A90D9] shadow-sm shadow-[#4A90D9]/50'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="mt-8 p-4 bg-white rounded-2xl shadow-lg max-w-sm w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1B365D]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#1B365D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[#7F8C8D] text-sm">
            Just carry your phone and live your life. We&apos;ll confirm you belong here.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <details className="mt-6 w-full max-w-sm group">
        <summary className="flex items-center justify-between p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors border border-white/10">
          <span className="text-white font-medium">Frequently Asked Questions</span>
          <svg className="w-5 h-5 text-white/60 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="mt-3 space-y-4 px-1">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="font-medium text-white">What if I travel for a few days?</p>
            <p className="text-white/60 text-sm mt-2">
              Short trips (up to 3 consecutive nights away) don&apos;t reset. You need 14 total nights, and movement on 10 of 14 days.
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="font-medium text-white">What data are you collecting?</p>
            <p className="text-white/60 text-sm mt-2">
              Only that your device is present and moving naturally. No personal info, ever.
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="font-medium text-white">What counts as movement?</p>
            <p className="text-white/60 text-sm mt-2">
              Normal daily activity — walking, driving, carrying your phone. We&apos;re just making sure a real person has the phone, not a box.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
