/**
 * Simple in-memory rate limiter using sliding window algorithm.
 * For production, consider using Redis or a distributed rate limiter.
 */

type RateLimitEntry = {
  timestamps: number[];
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetIn: number;
};

type RateLimiterConfig = {
  windowMs: number;
  maxRequests: number;
};

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
};

// In-memory store for rate limit entries
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let cleanupInterval: ReturnType<typeof setInterval> | undefined;

function startCleanup(windowMs: number) {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      // Remove timestamps older than the window
      entry.timestamps = entry.timestamps.filter(
        (timestamp) => now - timestamp < windowMs,
      );
      // Remove entry if no timestamps remain
      if (entry.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param identifier - Unique identifier for the client (e.g., IP address)
 * @param config - Rate limiter configuration
 * @returns Rate limit result with allowed status and metadata
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimiterConfig = DEFAULT_CONFIG,
): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests } = config;

  // Start cleanup if not already running
  startCleanup(windowMs);

  // Get or create entry for this identifier
  let entry = rateLimitStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(identifier, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(
    (timestamp) => now - timestamp < windowMs,
  );

  // Check if under the limit
  if (entry.timestamps.length < maxRequests) {
    // Record this request
    entry.timestamps.push(now);

    const firstTimestamp = entry.timestamps[0];
    return {
      allowed: true,
      remaining: maxRequests - entry.timestamps.length,
      resetIn: firstTimestamp === undefined ? windowMs : windowMs - (now - firstTimestamp),
    };
  }

  // Rate limit exceeded
  const oldestTimestamp = entry.timestamps[0];
  const resetIn = oldestTimestamp === undefined ? windowMs : windowMs - (now - oldestTimestamp);

  return {
    allowed: false,
    remaining: 0,
    resetIn,
  };
}

/**
 * Reset rate limit for a specific identifier.
 * Useful for testing or admin operations.
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status without incrementing the counter.
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimiterConfig = DEFAULT_CONFIG,
): RateLimitResult {
  const now = Date.now();
  const { windowMs, maxRequests } = config;

  const entry = rateLimitStore.get(identifier);
  if (!entry) {
    return {
      allowed: true,
      remaining: maxRequests,
      resetIn: windowMs,
    };
  }

  // Count valid timestamps
  const validTimestamps = entry.timestamps.filter(
    (timestamp) => now - timestamp < windowMs,
  );

  const remaining = Math.max(0, maxRequests - validTimestamps.length);
  const oldestTimestamp = validTimestamps[0];
  const resetIn = oldestTimestamp ? windowMs - (now - oldestTimestamp) : windowMs;

  return {
    allowed: remaining > 0,
    remaining,
    resetIn,
  };
}

