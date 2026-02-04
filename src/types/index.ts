export type DeviceStatus = 'verifying' | 'active' | 'inactive' | 'revoked' | 'failed' | 'frozen';
export type SubscriptionType = 'paid' | 'subsidized';
export type MotionPattern = 'wave' | 'pulse' | 'ripple' | 'spiral';
export type SubsidyRequestStatus = 'pending' | 'approved' | 'expired' | 'activated';
export type VehicleType = 'sedan' | 'truck' | 'suv' | 'van' | 'motorcycle' | 'none';
export type PaywallStatus = 'pending' | 'active' | 'grace' | 'expired' | 'blocked';

export interface SubscriptionStatus {
  hasAccess: boolean;
  status: PaywallStatus;
  subscriptionType: SubscriptionType;
  expiresAt: string | null;
  isInGracePeriod: boolean;
  daysUntilExpiry: number | null;
  renewalRequired: boolean;
}

export interface Zone {
  zone_id: string;
  zone_name: string;
  zone_boundary_hashes: string[] | null;
  h3_index: string | null;
  h3_resolution: number | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  motion_pattern: MotionPattern;
  active_resident_count: number;
  created_at: string;
}

export interface DeviceToken {
  device_token: string;
  device_fingerprint_hash: string;
  zone_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_type: SubscriptionType;
  status: DeviceStatus;
  verification_start_date: string | null;
  nights_confirmed: number;
  movement_days_confirmed: number;
  created_at: string;
  last_presence_at: string | null;
  last_movement_at: string | null;
  deactivated_at: string | null;
}

export interface BadgeSeed {
  zone_id: string;
  seed: string;
  valid_from: string;
  valid_until: string;
}

export interface PresenceLog {
  id: string;
  device_token: string;
  location_hash: string;
  wifi_hash: string | null;
  confirmed: boolean;
  checked_at: string;
}

export interface MovementLog {
  id: string;
  device_token: string;
  movement_date: string;
  movement_detected: boolean;
}

export interface IncidentReport {
  id: string;
  zone_id: string;
  photo_encrypted: string | null;
  vehicle_color: string | null;
  vehicle_type: VehicleType | null;
  license_plate_encrypted: string | null;
  location_note: string | null;
  notes_encrypted: string | null;
  corroboration_count: number;
  reported_at: string;
  expires_at: string;
}

export interface SubsidyPool {
  zone_id: string;
  balance: number;
  total_contributed: number;
  total_disbursed: number;
  updated_at: string;
}

export interface SubsidyRequest {
  request_id: string;
  device_token: string;
  zone_id: string;
  vouch_count: number;
  status: SubsidyRequestStatus;
  qr_code_data: string | null;
  created_at: string;
  expires_at: string;
}

export interface Vouch {
  id: string;
  voucher_device_token: string;
  vouchee_device_token: string;
  zone_id: string;
  vouched_at: string;
}

export interface Blacklist {
  device_fingerprint_hash: string;
  reason: string;
  zone_id: string | null;
  blacklisted_at: string;
}

export interface BadgeState {
  status: DeviceStatus;
  zone: Zone | null;
  seed: string | null;
  isSubsidized: boolean;
  nightsConfirmed: number;
  movementDaysConfirmed: number;
  verificationStartDate: string | null;
}

export interface ScanResult {
  success: boolean;
  zoneName?: string;
  error?: string;
}

export interface IncidentFormData {
  photo?: string;
  vehicleColor?: string;
  vehicleType?: VehicleType;
  licensePlate?: string;
  locationNote?: string;
  notes?: string;
}

export interface Alert {
  id: string;
  zoneId: string;
  zoneName: string;
  photo?: string;
  vehicleColor?: string;
  vehicleType?: VehicleType;
  licensePlate?: string;
  locationNote?: string;
  notes?: string;
  corroborationCount: number;
  reportedAt: string;
  expiresAt: string;
}
