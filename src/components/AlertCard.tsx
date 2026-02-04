'use client';

import { useState } from 'react';
import type { Alert } from '@/types';

interface AlertCardProps {
  alert: Alert;
  onCorroborate: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
}

export default function AlertCard({ alert, onCorroborate, onDismiss }: AlertCardProps) {
  const [hasCorroborated, setHasCorroborated] = useState(false);

  const handleCorroborate = () => {
    if (!hasCorroborated) {
      setHasCorroborated(true);
      onCorroborate(alert.id);
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E0E0E0] overflow-hidden">
      {/* Alert Header */}
      <div className="px-4 py-3 bg-[#E74C3C]/5 border-b border-[#E74C3C]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#E74C3C]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#E74C3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="text-[#E74C3C] font-semibold text-sm">Community Alert</span>
        </div>
        <span className="text-[#7F8C8D] text-xs bg-white px-2 py-1 rounded-full">
          {timeAgo(alert.reportedAt)}
        </span>
      </div>

      {/* Photo */}
      {alert.photo && (
        <div className="aspect-video bg-[#1B365D]/5">
          <img
            src={alert.photo}
            alt="Incident"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Vehicle Info */}
        {(alert.vehicleColor || alert.vehicleType) && (
          <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#1B365D]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#1B365D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[#7F8C8D]">Vehicle</p>
              <p className="text-[#2C3E50] font-semibold">
                {[alert.vehicleColor, alert.vehicleType].filter(Boolean).join(' ')}
              </p>
            </div>
          </div>
        )}

        {/* License Plate */}
        {alert.licensePlate && (
          <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#F5A623]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#F5A623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[#7F8C8D]">License Plate</p>
              <p className="text-[#2C3E50] font-mono font-bold tracking-wider">
                {alert.licensePlate}
              </p>
            </div>
          </div>
        )}

        {/* Location */}
        {alert.locationNote && (
          <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#4A90D9]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[#7F8C8D]">Location</p>
              <p className="text-[#2C3E50] font-medium">{alert.locationNote}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {alert.notes && (
          <div className="p-3 bg-[#1B365D]/5 rounded-xl border border-[#1B365D]/10">
            <p className="text-[#2C3E50] text-sm">{alert.notes}</p>
          </div>
        )}

        {/* Corroboration Count */}
        {alert.corroborationCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(alert.corroborationCount, 3) }).map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-[#2ECC71] border-2 border-white flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ))}
            </div>
            <span className="text-[#2ECC71] font-medium">
              +{alert.corroborationCount} {alert.corroborationCount === 1 ? 'person has' : 'people have'} seen this
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 pt-0 flex gap-3">
        <button
          onClick={handleCorroborate}
          disabled={hasCorroborated}
          className={`flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            hasCorroborated
              ? 'bg-[#2ECC71]/10 text-[#2ECC71] border border-[#2ECC71]/20'
              : 'bg-[#F5A623]/10 text-[#F5A623] hover:bg-[#F5A623]/20 border border-[#F5A623]/20'
          }`}
        >
          {hasCorroborated ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Confirmed
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              I see this too
            </>
          )}
        </button>
        <button
          onClick={() => onDismiss(alert.id)}
          className="flex-1 py-3 rounded-xl bg-[#FAFAFA] text-[#7F8C8D] font-semibold hover:bg-[#E0E0E0] transition-colors border border-[#E0E0E0]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
