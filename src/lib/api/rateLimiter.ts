// Rate Limiter Utility
// src/lib/api/rateLimiter.ts
// Simple in-memory rate limiter for API endpoints

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// In-memory store for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

// Start cleanup on module load
startCleanup();

// Default rate limit configurations by endpoint type
export const RateLimitConfigs = {
  // AI generation endpoints - more restrictive
  'cover-letter-generate': { maxRequests: 10, windowMs: 3600000 }, // 10/hour
  'career-assessment': { maxRequests: 5, windowMs: 86400000 }, // 5/day
  'job-analysis': { maxRequests: 20, windowMs: 3600000 }, // 20/hour
  'tailored-resume': { maxRequests: 15, windowMs: 3600000 }, // 15/hour

  // Chat endpoints - more lenient
  'lex-chat': { maxRequests: 100, windowMs: 3600000 }, // 100/hour

  // Default fallback
  'default': { maxRequests: 60, windowMs: 60000 }, // 60/minute
} as const;

export type RateLimitEndpoint = keyof typeof RateLimitConfigs;

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  userId: string,
  endpoint: RateLimitEndpoint | string,
  customConfig?: RateLimitConfig
): { limited: boolean; remaining: number; resetIn: number } {
  const config = customConfig || RateLimitConfigs[endpoint as RateLimitEndpoint] || RateLimitConfigs.default;
  const key = `${userId}:${endpoint}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // No existing entry or expired
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    return {
      limited: true,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  // Increment counter
  entry.count++;
  return {
    limited: false,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now,
  };
}

/**
 * Reset rate limit for a user/endpoint combination
 * Useful for testing or admin operations
 */
export function resetRateLimit(userId: string, endpoint: string): void {
  const key = `${userId}:${endpoint}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  userId: string,
  endpoint: RateLimitEndpoint | string
): { count: number; remaining: number; resetIn: number } | null {
  const config = RateLimitConfigs[endpoint as RateLimitEndpoint] || RateLimitConfigs.default;
  const key = `${userId}:${endpoint}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    return null;
  }

  return {
    count: entry.count,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetIn: entry.resetAt - now,
  };
}

/**
 * Middleware-style rate limit check that returns the Errors.rateLimited response if needed
 */
export async function withRateLimit(
  userId: string | null,
  endpoint: RateLimitEndpoint | string,
  customConfig?: RateLimitConfig
): Promise<{ limited: boolean; response?: ReturnType<typeof import('./errors').Errors.rateLimited> }> {
  if (!userId) {
    // No user ID means not authenticated, let auth middleware handle it
    return { limited: false };
  }

  const result = checkRateLimit(userId, endpoint, customConfig);

  if (result.limited) {
    const { Errors } = await import('./errors');
    return {
      limited: true,
      response: Errors.rateLimited(Math.ceil(result.resetIn / 1000)),
    };
  }

  return { limited: false };
}
