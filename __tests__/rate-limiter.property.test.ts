import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  checkRateLimit,
  resetRateLimit,
  type RateLimitConfig,
} from '@/lib/rate-limiter';

// Feature: mimamori-reliability-audit, Property 14: Rate limiter enforces request limits

/**
 * Property 14: Rate limiter enforces request limits
 *
 * For any user email and rate limit configuration (maxRequests per windowMs),
 * the rate limiter should allow the first maxRequests requests within the window
 * and reject subsequent requests with allowed: false until the window expires.
 *
 * **Validates: Requirements 25.1, 25.2, 25.3**
 */

describe('Property 14: Rate limiter enforces request limits', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('allows exactly the first maxRequests calls and rejects the next', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 10_000, max: 120_000 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (maxRequests, windowMs, keySuffix) => {
          resetRateLimit();

          const key = `route:${keySuffix}@example.com`;
          const config: RateLimitConfig = { maxRequests, windowMs };

          // First maxRequests calls should all be allowed
          for (let i = 0; i < maxRequests; i++) {
            const result = checkRateLimit(key, config);
            expect(result.allowed).toBe(true);
            expect(result.retryAfterMs).toBeUndefined();
          }

          // The (maxRequests+1)th call should be rejected
          const rejected = checkRateLimit(key, config);
          expect(rejected.allowed).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns retryAfterMs > 0 and <= windowMs when rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 10_000, max: 120_000 }),
        (maxRequests, windowMs) => {
          resetRateLimit();

          const key = `route:user@test.com`;
          const config: RateLimitConfig = { maxRequests, windowMs };

          // Exhaust the limit
          for (let i = 0; i < maxRequests; i++) {
            checkRateLimit(key, config);
          }

          // Rejected call should have valid retryAfterMs
          const result = checkRateLimit(key, config);
          expect(result.allowed).toBe(false);
          expect(result.retryAfterMs).toBeDefined();
          expect(result.retryAfterMs).toBeGreaterThan(0);
          expect(result.retryAfterMs).toBeLessThanOrEqual(windowMs);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('isolates different keys — exhausting one key does not affect another', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 10_000, max: 60_000 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (maxRequests, windowMs, suffixA, suffixB) => {
          resetRateLimit();

          // Ensure keys are distinct
          const keyA = `routeA:${suffixA}@a.com`;
          const keyB = `routeB:${suffixB}@b.com`;
          const config: RateLimitConfig = { maxRequests, windowMs };

          // Exhaust keyA
          for (let i = 0; i < maxRequests; i++) {
            checkRateLimit(keyA, config);
          }
          expect(checkRateLimit(keyA, config).allowed).toBe(false);

          // keyB should still be fully available
          const resultB = checkRateLimit(keyB, config);
          expect(resultB.allowed).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('continues rejecting all calls beyond maxRequests within the same window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 10 }),
        (maxRequests, extraCalls) => {
          resetRateLimit();

          const key = 'route:overflow@test.com';
          const config: RateLimitConfig = { maxRequests, windowMs: 60_000 };

          // Exhaust the limit
          for (let i = 0; i < maxRequests; i++) {
            checkRateLimit(key, config);
          }

          // Every additional call should also be rejected
          for (let i = 0; i < extraCalls; i++) {
            const result = checkRateLimit(key, config);
            expect(result.allowed).toBe(false);
            expect(result.retryAfterMs).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
