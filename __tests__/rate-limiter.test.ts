import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  RateLimitConfig,
} from '../lib/rate-limiter';

const config: RateLimitConfig = { maxRequests: 3, windowMs: 60_000 };

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('allows requests under the limit', () => {
    const result = checkRateLimit('test:user@example.com', config);
    expect(result).toEqual({ allowed: true });
  });

  it('allows exactly maxRequests within the window', () => {
    for (let i = 0; i < config.maxRequests; i++) {
      const result = checkRateLimit('test:user@example.com', config);
      expect(result.allowed).toBe(true);
    }
  });

  it('rejects the request exceeding maxRequests', () => {
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('test:user@example.com', config);
    }
    const result = checkRateLimit('test:user@example.com', config);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('returns retryAfterMs that is at most windowMs', () => {
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('test:user@example.com', config);
    }
    const result = checkRateLimit('test:user@example.com', config);
    expect(result.retryAfterMs).toBeLessThanOrEqual(config.windowMs);
  });

  it('isolates different keys', () => {
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('route-a:user@example.com', config);
    }
    // Different key should still be allowed
    const result = checkRateLimit('route-b:user@example.com', config);
    expect(result.allowed).toBe(true);
  });

  it('resetRateLimit clears a specific key', () => {
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('test:user@example.com', config);
    }
    expect(checkRateLimit('test:user@example.com', config).allowed).toBe(false);

    resetRateLimit('test:user@example.com');
    expect(checkRateLimit('test:user@example.com', config).allowed).toBe(true);
  });

  it('resetRateLimit with no args clears all keys', () => {
    for (let i = 0; i < config.maxRequests; i++) {
      checkRateLimit('key-a:a@test.com', config);
      checkRateLimit('key-b:b@test.com', config);
    }
    resetRateLimit();
    expect(checkRateLimit('key-a:a@test.com', config).allowed).toBe(true);
    expect(checkRateLimit('key-b:b@test.com', config).allowed).toBe(true);
  });
});
