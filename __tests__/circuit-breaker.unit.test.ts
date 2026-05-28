import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  callWithCircuitBreaker,
  resetCircuitBreaker,
  type ServiceName,
} from '@/lib/circuit-breaker';

describe('callWithCircuitBreaker', () => {
  const service: ServiceName = 'gemini';

  beforeEach(() => {
    resetCircuitBreaker(service);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the result of a successful call in closed state', async () => {
    const result = await callWithCircuitBreaker(service, () => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('propagates errors from the underlying function', async () => {
    await expect(
      callWithCircuitBreaker(service, () => Promise.reject(new Error('fail'))),
    ).rejects.toThrow('fail');
  });

  it('opens the circuit after 5 failures within the window', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow('fail');
    }

    // 6th call should be rejected immediately without calling fn
    const fn = vi.fn(() => Promise.resolve('should not be called'));
    await expect(callWithCircuitBreaker(service, fn)).rejects.toThrow(
      'Circuit breaker is open for service: gemini',
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('transitions from open to half-open after halfOpenMs', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow();
    }

    // Advance time past the half-open timeout (30s)
    vi.advanceTimersByTime(30_000);

    // Next call should go through (half-open probe)
    const result = await callWithCircuitBreaker(service, () => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
  });

  it('closes the circuit on successful probe in half-open state', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow();
    }

    vi.advanceTimersByTime(30_000);

    // Successful probe
    await callWithCircuitBreaker(service, () => Promise.resolve('ok'));

    // Circuit should be closed — subsequent calls go through normally
    const result = await callWithCircuitBreaker(service, () => Promise.resolve('normal'));
    expect(result).toBe('normal');
  });

  it('reopens the circuit on failed probe in half-open state', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow();
    }

    vi.advanceTimersByTime(30_000);

    // Failed probe
    await expect(
      callWithCircuitBreaker(service, () => Promise.reject(new Error('still broken'))),
    ).rejects.toThrow('still broken');

    // Circuit should be open again
    const fn = vi.fn(() => Promise.resolve('nope'));
    await expect(callWithCircuitBreaker(service, fn)).rejects.toThrow(
      'Circuit breaker is open for service: gemini',
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not open the circuit if failures are outside the window', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    // 4 failures
    for (let i = 0; i < 4; i++) {
      await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow();
    }

    // Advance past the 60s window
    vi.advanceTimersByTime(61_000);

    // 1 more failure — should reset counter since previous failures are outside window
    await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow();

    // Circuit should still be closed (only 1 failure in current window)
    const result = await callWithCircuitBreaker(service, () => Promise.resolve('still open'));
    expect(result).toBe('still open');
  });

  it('maintains separate state per service', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    resetCircuitBreaker('supabase');

    // Open the gemini circuit
    for (let i = 0; i < 5; i++) {
      await expect(callWithCircuitBreaker('gemini', fail)).rejects.toThrow();
    }

    // Supabase circuit should still be closed
    const result = await callWithCircuitBreaker('supabase', () => Promise.resolve('supabase ok'));
    expect(result).toBe('supabase ok');

    resetCircuitBreaker('supabase');
  });

  it('respects custom config values', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    const customConfig = { failureThreshold: 2, halfOpenMs: 5_000 };

    // 2 failures should open with threshold=2
    for (let i = 0; i < 2; i++) {
      await expect(
        callWithCircuitBreaker(service, fail, customConfig),
      ).rejects.toThrow();
    }

    // Should be open
    const fn = vi.fn(() => Promise.resolve('nope'));
    await expect(
      callWithCircuitBreaker(service, fn, customConfig),
    ).rejects.toThrow('Circuit breaker is open');
    expect(fn).not.toHaveBeenCalled();

    // Advance 5s (custom halfOpenMs)
    vi.advanceTimersByTime(5_000);

    const result = await callWithCircuitBreaker(
      service,
      () => Promise.resolve('recovered'),
      customConfig,
    );
    expect(result).toBe('recovered');
  });

  it('resetCircuitBreaker clears state', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 5; i++) {
      await expect(callWithCircuitBreaker(service, fail)).rejects.toThrow();
    }

    // Circuit is open
    await expect(
      callWithCircuitBreaker(service, () => Promise.resolve('nope')),
    ).rejects.toThrow('Circuit breaker is open');

    // Reset
    resetCircuitBreaker(service);

    // Should work again
    const result = await callWithCircuitBreaker(service, () => Promise.resolve('fresh'));
    expect(result).toBe('fresh');
  });
});
