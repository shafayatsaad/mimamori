import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  callWithCircuitBreaker,
  resetCircuitBreaker,
  type ServiceName,
} from '@/lib/circuit-breaker';

// Feature: mimamori-reliability-audit, Property 16: Circuit breaker state machine transitions

/**
 * Property 16: Circuit breaker state machine transitions
 *
 * For any sequence of call results (success/failure) to a circuit breaker,
 * the circuit should transition from closed to open after 5 consecutive
 * failures within 60 seconds, from open to half-open after 30 seconds,
 * from half-open to closed on a successful probe, and from half-open back
 * to open on a failed probe. While open, all calls should immediately fail
 * without invoking the underlying function.
 *
 * **Validates: Requirements 28.2, 28.3, 28.4, 28.5**
 */

const SERVICE: ServiceName = 'bedrock';

describe('Property 16: Circuit breaker state machine transitions', () => {
  beforeEach(() => {
    resetCircuitBreaker(SERVICE);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the circuit after 5 consecutive failures and rejects further calls without invoking fn', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 15 }),
        async (extraCalls) => {
          resetCircuitBreaker(SERVICE);

          // Produce exactly 5 failures to open the circuit
          for (let i = 0; i < 5; i++) {
            await callWithCircuitBreaker(SERVICE, () =>
              Promise.reject(new Error('fail')),
            ).catch(() => {});
          }

          // All subsequent calls should fail immediately without invoking fn
          for (let i = 0; i < extraCalls; i++) {
            const fn = vi.fn(() => Promise.resolve('should not run'));
            try {
              await callWithCircuitBreaker(SERVICE, fn);
              // Should not reach here
              expect.unreachable('Expected circuit breaker to throw');
            } catch (e: unknown) {
              expect((e as Error).message).toContain('Circuit breaker is open');
            }
            expect(fn).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('stays closed when fewer than 5 failures occur within the window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 4 }),
        async (failCount) => {
          resetCircuitBreaker(SERVICE);

          for (let i = 0; i < failCount; i++) {
            await callWithCircuitBreaker(SERVICE, () =>
              Promise.reject(new Error('fail')),
            ).catch(() => {});
          }

          // Circuit should still be closed — fn should be invoked
          const fn = vi.fn(() => Promise.resolve('ok'));
          const result = await callWithCircuitBreaker(SERVICE, fn);
          expect(result).toBe('ok');
          expect(fn).toHaveBeenCalledOnce();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('transitions from open to half-open after halfOpenMs, allowing a probe through', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 30_000, max: 120_000 }),
        async (waitMs) => {
          resetCircuitBreaker(SERVICE);

          // Open the circuit with 5 failures
          for (let i = 0; i < 5; i++) {
            await callWithCircuitBreaker(SERVICE, () =>
              Promise.reject(new Error('fail')),
            ).catch(() => {});
          }

          // Advance time past halfOpenMs (default 30s)
          vi.advanceTimersByTime(waitMs);

          // The probe should be allowed through (half-open state)
          const fn = vi.fn(() => Promise.resolve('probe-ok'));
          const result = await callWithCircuitBreaker(SERVICE, fn);
          expect(result).toBe('probe-ok');
          expect(fn).toHaveBeenCalledOnce();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('closes the circuit on a successful probe in half-open state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (subsequentCalls) => {
          resetCircuitBreaker(SERVICE);

          // Open the circuit
          for (let i = 0; i < 5; i++) {
            await callWithCircuitBreaker(SERVICE, () =>
              Promise.reject(new Error('fail')),
            ).catch(() => {});
          }

          // Transition to half-open
          vi.advanceTimersByTime(30_000);

          // Successful probe closes circuit
          await callWithCircuitBreaker(SERVICE, () => Promise.resolve('probe-ok'));

          // All subsequent calls should succeed (circuit is closed)
          for (let i = 0; i < subsequentCalls; i++) {
            const fn = vi.fn(() => Promise.resolve(`call-${i}`));
            const result = await callWithCircuitBreaker(SERVICE, fn);
            expect(result).toBe(`call-${i}`);
            expect(fn).toHaveBeenCalledOnce();
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('reopens the circuit on a failed probe in half-open state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (extraCalls) => {
          resetCircuitBreaker(SERVICE);

          // Open the circuit
          for (let i = 0; i < 5; i++) {
            await callWithCircuitBreaker(SERVICE, () =>
              Promise.reject(new Error('fail')),
            ).catch(() => {});
          }

          // Transition to half-open
          vi.advanceTimersByTime(30_000);

          // Failed probe reopens circuit
          await callWithCircuitBreaker(SERVICE, () =>
            Promise.reject(new Error('probe-fail')),
          ).catch(() => {});

          // All subsequent calls should fail immediately (circuit is open again)
          for (let i = 0; i < extraCalls; i++) {
            const fn = vi.fn(() => Promise.resolve('should not run'));
            try {
              await callWithCircuitBreaker(SERVICE, fn);
              expect.unreachable('Expected circuit breaker to throw');
            } catch (e: unknown) {
              expect((e as Error).message).toContain('Circuit breaker is open');
            }
            expect(fn).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
