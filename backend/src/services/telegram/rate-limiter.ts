/**
 * Simple in-memory rate limiter for Telegram link operations
 * Implements sliding window with 5 attempts per minute per user
 */

interface RateLimitEntry {
  attempts: number[];
}

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 5;

// In-memory store (for single-instance deployment)
// For production scale, upgrade to Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if user has exceeded rate limit
 * @param userId User ID to check
 * @returns true if rate limited, false if allowed
 */
export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry) {
    // First attempt
    rateLimitStore.set(userId, { attempts: [now] });
    return false;
  }

  // Filter out attempts outside the window
  const recentAttempts = entry.attempts.filter(
    (timestamp) => now - timestamp < WINDOW_MS
  );

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    // Rate limited
    return true;
  }

  // Add new attempt
  recentAttempts.push(now);
  rateLimitStore.set(userId, { attempts: recentAttempts });
  return false;
}

/**
 * Get remaining attempts for a user
 * @param userId User ID to check
 * @returns Number of remaining attempts in current window
 */
export function getRemainingAttempts(userId: string): number {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry) {
    return MAX_ATTEMPTS;
  }

  const recentAttempts = entry.attempts.filter(
    (timestamp) => now - timestamp < WINDOW_MS
  );

  return Math.max(0, MAX_ATTEMPTS - recentAttempts.length);
}

/**
 * Clean up old entries (call periodically to prevent memory leaks)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [userId, entry] of rateLimitStore.entries()) {
    const recentAttempts = entry.attempts.filter(
      (timestamp) => now - timestamp < WINDOW_MS
    );
    if (recentAttempts.length === 0) {
      rateLimitStore.delete(userId);
    } else {
      rateLimitStore.set(userId, { attempts: recentAttempts });
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
