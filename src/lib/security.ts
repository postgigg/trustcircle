/**
 * Server-side Security Library
 * Handles IP blacklisting, rate limiting, threat logging, and input validation
 * PRIVACY: Only stores IP addresses (from request headers) and fingerprint hashes
 */

import { supabase } from './supabase';

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /('\s*(OR|AND)\s*'?\d*'?\s*=\s*'?\d*)/i,
  /(;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)\s+)/i,
  /(\bunion\b.*\bselect\b)/i,
  /(\bselect\b.*\bfrom\b.*\bwhere\b)/i,
  /(--\s|#\s|\/\*)/,
  /('\s*;\s*--)/,
  /(exec\s*\(|execute\s*\()/i,
  /(xp_|sp_)/i,
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<script[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /data:\s*text\/html/gi,
  /vbscript:/gi,
];

/**
 * Extract client IP from request headers (handles proxies)
 */
export function getClientIP(request: Request): string {
  // Check various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  // Fallback
  return 'unknown';
}

/**
 * Check if an IP is blacklisted
 */
export async function isIPBlacklisted(ip: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_ip_blacklisted', { p_ip: ip });
    if (error) {
      console.error('Error checking IP blacklist:', error);
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Blacklist an IP address
 */
export async function blacklistIP(
  ip: string,
  reason: string,
  expiresInHours?: number
): Promise<void> {
  try {
    await supabase.rpc('blacklist_ip', {
      p_ip: ip,
      p_reason: reason,
      p_expires_hours: expiresInHours ?? null,
    });
  } catch (error) {
    console.error('Error blacklisting IP:', error);
  }
}

/**
 * Log a threat event
 */
export async function logThreat(params: {
  ip: string;
  fingerprintHash?: string;
  threatType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  endpoint: string;
  actionTaken: 'logged' | 'blocked' | 'blacklisted';
}): Promise<void> {
  try {
    await supabase.rpc('log_threat_event', {
      p_ip: params.ip,
      p_fingerprint_hash: params.fingerprintHash ?? null,
      p_threat_type: params.threatType,
      p_severity: params.severity,
      p_endpoint: params.endpoint,
      p_action: params.actionTaken,
    });

    // Check if auto-blacklist threshold exceeded
    await supabase.rpc('check_auto_blacklist', { p_ip: params.ip });
  } catch (error) {
    console.error('Error logging threat:', error);
  }
}

/**
 * Enhanced rate limiting by IP
 */
export async function checkRateLimit(params: {
  ip: string;
  endpoint: string;
  maxRequests: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const identifier = `${params.ip}:${params.endpoint}`;

  try {
    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('action_type', 'api_request')
      .single();

    const now = Date.now();

    if (rateLimit) {
      const windowStart = new Date(rateLimit.window_start).getTime();
      const windowMs = params.windowSeconds * 1000;
      const windowEnd = windowStart + windowMs;

      if (now < windowEnd) {
        // Still in current window
        if (rateLimit.action_count >= params.maxRequests) {
          return {
            allowed: false,
            remaining: 0,
            resetIn: Math.ceil((windowEnd - now) / 1000),
          };
        }

        // Increment count
        await supabase
          .from('rate_limits')
          .update({ action_count: rateLimit.action_count + 1 })
          .eq('identifier', identifier);

        return {
          allowed: true,
          remaining: params.maxRequests - rateLimit.action_count - 1,
          resetIn: Math.ceil((windowEnd - now) / 1000),
        };
      } else {
        // Window expired, reset
        await supabase
          .from('rate_limits')
          .update({
            action_count: 1,
            window_start: new Date().toISOString(),
          })
          .eq('identifier', identifier);

        return {
          allowed: true,
          remaining: params.maxRequests - 1,
          resetIn: params.windowSeconds,
        };
      }
    } else {
      // Create new rate limit entry
      await supabase.from('rate_limits').insert({
        identifier,
        action_type: 'api_request',
        action_count: 1,
        window_start: new Date().toISOString(),
      });

      return {
        allowed: true,
        remaining: params.maxRequests - 1,
        resetIn: params.windowSeconds,
      };
    }
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open to not block legitimate requests
    return { allowed: true, remaining: params.maxRequests, resetIn: params.windowSeconds };
  }
}

/**
 * Check if a nonce has been used (replay attack prevention)
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('use_nonce', { p_nonce: nonce });
    if (error) {
      console.error('Error checking nonce:', error);
      return false;
    }
    // use_nonce returns true if the nonce was NEW (not used before)
    // So we return the opposite - true if it WAS used before
    return data === false;
  } catch {
    return false;
  }
}

/**
 * Detect SQL injection in input
 */
export function detectSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect XSS in input
 */
export function detectXSS(input: string): boolean {
  if (!input || typeof input !== 'string') return false;

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitize input by removing dangerous patterns
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let sanitized = input;

  // Remove script tags
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: URLs
  sanitized = sanitized.replace(/data:\s*text\/html/gi, '');

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized;
}

/**
 * Recursively check object for malicious patterns
 */
export function scanObjectForThreats(obj: unknown): {
  hasSQLInjection: boolean;
  hasXSS: boolean;
  threats: string[];
} {
  const threats: string[] = [];
  let hasSQLInjection = false;
  let hasXSS = false;

  function scan(value: unknown, path: string = '') {
    if (typeof value === 'string') {
      if (detectSQLInjection(value)) {
        hasSQLInjection = true;
        threats.push(`SQL injection at ${path || 'root'}`);
      }
      if (detectXSS(value)) {
        hasXSS = true;
        threats.push(`XSS at ${path || 'root'}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
        scan(val, path ? `${path}.${key}` : key);
      });
    }
  }

  scan(obj);

  return { hasSQLInjection, hasXSS, threats };
}

/**
 * Validate request timestamp (prevent replay with old timestamps)
 */
export function isValidTimestamp(timestamp: number, toleranceMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= toleranceMs;
}

/**
 * Count devices from same IP in last 24 hours
 */
export async function countDevicesFromIP(ip: string): Promise<number> {
  // This would require tracking IP during registration
  // For now, return 0 as we don't track registration IPs
  return 0;
}

/**
 * Get threat count for an IP in the last N hours
 */
export async function getThreatCount(ip: string, hours: number = 24): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('count_recent_threats', {
      p_ip: ip,
      p_hours: hours,
    });

    if (error) {
      console.error('Error getting threat count:', error);
      return 0;
    }

    return data || 0;
  } catch {
    return 0;
  }
}
