'use client';

import { useState, useRef } from 'react';
import type { VehicleType, IncidentFormData } from '@/types';

interface IncidentFormProps {
  zoneName: string;
  onSubmit: (data: IncidentFormData) => void;
  onSkip: () => void;
}

const VEHICLE_COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Brown', hex: '#78350F' },
  { name: 'Other', hex: '#6B7280' },
];

const VEHICLE_TYPES: { type: VehicleType; label: string; icon: string }[] = [
  { type: 'sedan', label: 'Sedan', icon: '🚗' },
  { type: 'truck', label: 'Truck', icon: '🛻' },
  { type: 'suv', label: 'SUV', icon: '🚙' },
  { type: 'van', label: 'Van', icon: '🚐' },
  { type: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
  { type: 'none', label: 'On foot', icon: '🚶' },
];

export default function IncidentForm({ zoneName, onSubmit, onSkip }: IncidentFormProps) {
  const [photo, setPhoto] = useState<string | undefined>();
  const [vehicleColor, setVehicleColor] = useState<string | undefined>();
  const [vehicleType, setVehicleType] = useState<VehicleType | undefined>();
  const [licensePlate, setLicensePlate] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [notes, setNotes] = useState('');
  const [showCamera, setShowCamera] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhoto(dataUrl);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const retakePhoto = () => {
    setPhoto(undefined);
    startCamera();
  };

  const handleSubmit = () => {
    onSubmit({
      photo,
      vehicleColor,
      vehicleType,
      licensePlate: licensePlate || undefined,
      locationNote: locationNote || undefined,
      notes: notes || undefined,
    });
  };

  useState(() => {
    if (showCamera) {
      startCamera();
    }
    return () => stopCamera();
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      <div className="bg-[#E74C3C] text-white p-6">
        <h1 className="text-xl font-bold">Community Alert</h1>
        <p className="text-white/80 mt-1">Help keep {zoneName} safe</p>
      </div>

      <div className="p-4 space-y-6">
        {showCamera && (
          <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
            {photo ? (
              <>
                <img src={photo} alt="Captured" className="w-full h-full object-cover" />
                <button
                  onClick={retakePhoto}
                  className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 rounded-lg text-sm font-medium"
                >
                  Retake
                </button>
              </>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-[#E74C3C] flex items-center justify-center"
                >
                  <div className="w-12 h-12 bg-[#E74C3C] rounded-full" />
                </button>
              </>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#2C3E50] mb-2">
            Vehicle Color
          </label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => setVehicleColor(color.name)}
                className={`w-10 h-10 rounded-full border-2 transition-all ${
                  vehicleColor === color.name
                    ? 'border-[#1B365D] scale-110'
                    : 'border-[#E0E0E0]'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#2C3E50] mb-2">
            Vehicle Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TYPES.map((vehicle) => (
              <button
                key={vehicle.type}
                onClick={() => setVehicleType(vehicle.type)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  vehicleType === vehicle.type
                    ? 'border-[#1B365D] bg-[#1B365D]/5'
                    : 'border-[#E0E0E0]'
                }`}
              >
                <div className="text-2xl">{vehicle.icon}</div>
                <div className="text-xs mt-1 text-[#2C3E50]">{vehicle.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#2C3E50] mb-2">
            License Plate
          </label>
          <input
            type="text"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            placeholder="ABC 1234"
            className="w-full p-3 rounded-xl border-2 border-[#E0E0E0] text-lg font-mono uppercase focus:border-[#4A90D9] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#2C3E50] mb-2">
            Location
          </label>
          <input
            type="text"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="Near house # or cross street"
            className="w-full p-3 rounded-xl border-2 border-[#E0E0E0] focus:border-[#4A90D9] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#2C3E50] mb-2">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 200))}
            placeholder="Any other details..."
            maxLength={200}
            rows={3}
            className="w-full p-3 rounded-xl border-2 border-[#E0E0E0] resize-none focus:border-[#4A90D9] focus:outline-none"
          />
          <p className="text-right text-xs text-[#7F8C8D] mt-1">{notes.length}/200</p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-neutral-200 safe-area-pb">
        {/* Privacy note */}
        <div className="mb-3 flex items-start gap-2 text-xs text-neutral-500">
          <svg className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>
            This report is anonymous. Only your neighborhood can see it, and it expires in 24 hours.
          </span>
        </div>
        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-red-500 text-white rounded-xl font-bold text-lg hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Send Alert
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 mt-2 text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
