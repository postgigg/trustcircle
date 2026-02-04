'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Scanner from '@/components/Scanner';
import IncidentForm from '@/components/IncidentForm';
import type { IncidentFormData } from '@/types';

type ViewState = 'scanner' | 'success' | 'failed' | 'incident';

// Anyone can verify someone - no subscription required
export default function VerifyPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('scanner');
  const [verifiedZoneName, setVerifiedZoneName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleScanResult = (success: boolean, zoneName?: string) => {
    if (success && zoneName) {
      setVerifiedZoneName(zoneName);
      setView('success');
      setTimeout(() => {
        router.push('/');
      }, 5000);
    } else {
      setView('failed');
      setTimeout(() => {
        setView('incident');
      }, 2000);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleIncidentSubmit = async (data: IncidentFormData) => {
    setSubmitting(true);

    try {
      const response = await fetch('/api/incident/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: 'current-zone',
          ...data,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Alert sent to ${result.alertedResidents} verified residents.`);
        router.push('/');
      }
    } catch {
      alert('Failed to send alert. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipIncident = () => {
    router.push('/');
  };

  if (view === 'success') {
    return (
      <div className="fixed inset-0 bg-[#2ECC71] flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6">
          <svg className="w-14 h-14 text-[#2ECC71]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Verified Resident</h1>
        <p className="text-white/90 text-xl mt-2">{verifiedZoneName}</p>
        <p className="text-white/70 mt-6">Returning home...</p>
      </div>
    );
  }

  if (view === 'failed') {
    return (
      <div className="fixed inset-0 bg-[#E74C3C] flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mb-6">
          <svg className="w-14 h-14 text-[#E74C3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Not Recognized</h1>
        <p className="text-white/70 mt-4">Preparing incident report...</p>
      </div>
    );
  }

  if (view === 'incident') {
    return (
      <IncidentForm
        zoneName="Your Neighborhood"
        onSubmit={handleIncidentSubmit}
        onSkip={handleSkipIncident}
      />
    );
  }

  return <Scanner onResult={handleScanResult} onCancel={handleCancel} />;
}
