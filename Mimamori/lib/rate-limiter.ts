/**
 * In-memory sliding-window rate limiter.
 *
 * Keyed by "route:email" — each key tracks an array of request timestamps.
 * On each call, timestamps older than `windowMs` are pruned.
 * If the remaining count is below `maxRequests`, the request is allowed and
 * the current timestamp is recorded. Otherwise the request is rejected with
 * a `retryAfterMs` hint.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // default 60000 (1 minute)
}

const requestLog = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get existing timestamps or start fresh
  let timestamps = requestLog.get(key);
  if (!timestamps) {
    timestamps = [];
    requestLog.set(key, timestamps);
  }

  // Prune timestamps outside the current window
  const active = timestamps.filter((t) => t > windowStart);
  requestLog.set(key, active);

  if (active.length < config.maxRequests) {
    active.push(now);
    return { allowed: true };
  }

  // Oldest timestamp still in the window determines when the next slot opens
  const oldest = active[0];
  const retryAfterMs = oldest + config.windowMs - now;

  return { allowed: false, retryAfterMs };
}

/** Clear one key or all keys. Useful for testing. */
export function resetRateLimit(key?: string): void {
  if (key !== undefined) {
    requestLog.delete(key);
  } else {
    requestLog.clear();
  }
}
