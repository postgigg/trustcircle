'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDeviceToken, isRegistered, getZone } from '@/lib/storage';
import VouchConfirm from '@/components/VouchConfirm';

function VouchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vouchData, setVouchData] = useState<{
    voucheeToken: string;
    zoneId: string;
    zoneName: string;
  } | null>(null);
  const [vouchesRemaining, setVouchesRemaining] = useState(3);

  useEffect(() => {
    const parseVouchData = async () => {
      if (!isRegistered()) {
        setError('You must be a verified resident to vouch for others.');
        setLoading(false);
        return;
      }

      const zone = getZone();
      const qrData = searchParams.get('data');

      if (!qrData) {
        setError('Invalid QR code. Please scan again.');
        setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(decodeURIComponent(qrData));

        if (parsed.type !== 'tc_vouch') {
          setError('Invalid QR code type.');
          setLoading(false);
          return;
        }

        if (zone && parsed.zoneId !== zone.zone_id) {
          setError('This person is requesting subsidy for a different neighborhood.');
          setLoading(false);
          return;
        }

        setVouchData({
          voucheeToken: parsed.deviceToken,
          zoneId: parsed.zoneId,
          zoneName: zone?.zone_name || 'Your Neighborhood',
        });
        setLoading(false);
      } catch {
        setError('Failed to parse QR code data.');
        setLoading(false);
      }
    };

    parseVouchData();
  }, [searchParams]);

  const handleConfirmVouch = async () => {
    if (!vouchData) return;

    const deviceToken = getDeviceToken();
    if (!deviceToken) {
      throw new Error('You must be registered to vouch.');
    }

    const response = await fetch('/api/vouch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': deviceToken,
      },
      body: JSON.stringify({
        voucheeToken: vouchData.voucheeToken,
        zoneId: vouchData.zoneId,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.vouchesRemaining !== undefined) {
      setVouchesRemaining(data.vouchesRemaining);
    }
  };

  const handleCancel = () => {
    router.push('/badge');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#1B365D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-[#E74C3C]/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-[#E74C3C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-[#E74C3C] text-center">{error}</p>
        <button
          onClick={() => router.push('/badge')}
          className="mt-6 px-6 py-3 bg-[#1B365D] text-white rounded-xl font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (vouchData) {
    return (
      <VouchConfirm
        zoneName={vouchData.zoneName}
        vouchesRemaining={vouchesRemaining}
        onConfirm={handleConfirmVouch}
        onCancel={handleCancel}
      />
    );
  }

  return null;
}

export default function VouchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#1B365D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VouchContent />
    </Suspense>
  );
}
