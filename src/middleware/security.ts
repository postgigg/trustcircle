/**
 * Security Middleware for API Routes
 * Validates requests and blocks malicious traffic
 */

import {
  getClientIP,
  isIPBlacklisted,
  logThreat,
  checkRateLimit,
  isNonceUsed,
  scanObjectForThreats,
  isValidTimestamp,
  blacklistIP,
} from '@/lib/security';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  ip: string;
  rateLimit?: {
    remaining: number;
    resetIn: number;
  };
}

export interface SecurityMiddlewareOptions {
  // Rate limiting
  maxRequests?: number;
  windowSeconds?: number;

  // Skip certain checks
  skipRateLimit?: boolean;
  skipBlacklistCheck?: boolean;
  skipInputValidation?: boolean;

  // Nonce validation
  requireNonce?: boolean;

  // Timestamp validation
  requireTimestamp?: boolean;
  timestampTolerance?: number;
}

const DEFAULT_OPTIONS: SecurityMiddlewareOptions = {
  maxRequests: 60,
  windowSeconds: 60,
  skipRateLimit: false,
  skipBlacklistCheck: false,
  skipInputValidation: false,
  requireNonce: false,
  requireTimestamp: false,
  timestampTolerance: 5 * 60 * 1000, // 5 minutes
};

/**
 * Security middleware for API routes
 * Returns security check result with allow/deny decision
 */
export async function securityMiddleware(
  request: Request,
  options: SecurityMiddlewareOptions = {}
): Promise<SecurityCheckResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ip = getClientIP(request);
  const endpoint = new URL(request.url).pathname;

  // 1. Check IP blacklist
  if (!opts.skipBlacklistCheck) {
    const blacklisted = await isIPBlacklisted(ip);
    if (blacklisted) {
      await logThreat({
        ip,
        threatType: 'blacklisted_ip',
        severity: 'medium',
        endpoint,
        actionTaken: 'blocked',
      });

      return {
        allowed: false,
        reason: 'Access denied',
        ip,
      };
    }
  }

  // 2. Rate limiting
  if (!opts.skipRateLimit) {
    const rateLimit = await checkRateLimit({
      ip,
      endpoint,
      maxRequests: opts.maxRequests!,
      windowSeconds: opts.windowSeconds!,
    });

    if (!rateLimit.allowed) {
      await logThreat({
        ip,
        threatType: 'rate_limit',
        severity: 'low',
        endpoint,
        actionTaken: 'blocked',
      });

      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        ip,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetIn: rateLimit.resetIn,
        },
      };
    }
  }

  // 3. Input validation (for POST/PUT/PATCH requests with body)
  if (!opts.skipInputValidation && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      // Clone request to read body without consuming it
      const clonedRequest = request.clone();
      const contentType = request.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const body = await clonedRequest.json();
        const { hasSQLInjection, hasXSS, threats } = scanObjectForThreats(body);

        if (hasSQLInjection) {
          await logThreat({
            ip,
            threatType: 'sql_injection',
            severity: 'critical',
            endpoint,
            actionTaken: 'blacklisted',
          });

          // Immediate blacklist for SQL injection
          await blacklistIP(ip, 'sql_injection');

          return {
            allowed: false,
            reason: 'Invalid request',
            ip,
          };
        }

        if (hasXSS) {
          await logThreat({
            ip,
            threatType: 'xss',
            severity: 'high',
            endpoint,
            actionTaken: 'blocked',
          });

          // Blacklist after repeat XSS attempts (handled by auto-blacklist)
          return {
            allowed: false,
            reason: 'Invalid request',
            ip,
          };
        }

        // 4. Nonce validation (if required)
        if (opts.requireNonce && body.nonce) {
          const nonceUsed = await isNonceUsed(body.nonce);
          if (nonceUsed) {
            await logThreat({
              ip,
              threatType: 'replay_attack',
              severity: 'high',
              endpoint,
              actionTaken: 'blocked',
            });

            return {
              allowed: false,
              reason: 'Invalid request',
              ip,
            };
          }
        }

        // 5. Timestamp validation (if required)
        if (opts.requireTimestamp && body.timestamp) {
          if (!isValidTimestamp(body.timestamp, opts.timestampTolerance)) {
            await logThreat({
              ip,
              threatType: 'replay_attack',
              severity: 'medium',
              endpoint,
              actionTaken: 'blocked',
            });

            return {
              allowed: false,
              reason: 'Request expired',
              ip,
            };
          }
        }
      }
    } catch {
      // JSON parsing error - continue anyway
    }
  }

  // All checks passed
  return {
    allowed: true,
    ip,
  };
}

/**
 * Quick check for high-sensitivity endpoints
 * Includes nonce + timestamp validation
 */
export async function strictSecurityMiddleware(
  request: Request
): Promise<SecurityCheckResult> {
  return securityMiddleware(request, {
    maxRequests: 30,
    windowSeconds: 60,
    requireNonce: true,
    requireTimestamp: true,
    timestampTolerance: 60 * 1000, // 1 minute for strict endpoints
  });
}

/**
 * Relaxed check for read-only endpoints
 */
export async function relaxedSecurityMiddleware(
  request: Request
): Promise<SecurityCheckResult> {
  return securityMiddleware(request, {
    maxRequests: 120,
    windowSeconds: 60,
    skipInputValidation: true, // No body to validate on GET
  });
}

/**
 * Extract fingerprint hash from request for logging
 */
export function extractFingerprintHash(request: Request): string | undefined {
  // Check header first
  const headerHash = request.headers.get('x-fingerprint');
  if (headerHash) return headerHash;

  // Will be extracted from body during processing if needed
  return undefined;
}
