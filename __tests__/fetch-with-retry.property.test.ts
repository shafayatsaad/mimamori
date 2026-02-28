import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

// Feature: mimamori-reliability-audit, Property 13: Retry logic respects status code categories

/**
 * Property 13: Retry logic respects status code categories
 *
 * For any HTTP response, the retry function should retry on 5xx status codes
 * and network errors, and should NOT retry on 4xx status codes (400, 401, 403, 404).
 * The total number of attempts should not exceed maxRetries + 1.
 *
 * **Validates: Requirements 24.1, 24.3**
 */

const noDelay = async () => {};

function mockResponse(status: number): Response {
  return new Response(null, { status });
}

describe('Property 13: Retry logic respects status code categories', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not retry on any 4xx status code — fetch is called exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 499 }),
        fc.integer({ min: 1, max: 5 }),
        async (statusCode, maxRetries) => {
          fetchSpy.mockReset();
          fetchSpy.mockResolvedValue(mockResponse(statusCode));

          const res = await fetchWithRetry(
            '/api/test',
            {},
            { maxRetries },
            noDelay,
          );

          expect(res.status).toBe(statusCode);
          expect(fetchSpy).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('retries on any 5xx status code — fetch is called maxRetries + 1 times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 500, max: 599 }),
        fc.integer({ min: 1, max: 5 }),
        async (statusCode, maxRetries) => {
          fetchSpy.mockReset();
          fetchSpy.mockResolvedValue(mockResponse(statusCode));

          const res = await fetchWithRetry(
            '/api/test',
            {},
            { maxRetries },
            noDelay,
          );

          expect(res.status).toBe(statusCode);
          expect(fetchSpy).toHaveBeenCalledTimes(maxRetries + 1);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('retries on network errors — fetch is called maxRetries + 1 times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (maxRetries, errorMessage) => {
          fetchSpy.mockReset();
          fetchSpy.mockRejectedValue(new Error(errorMessage));

          await expect(
            fetchWithRetry('/api/test', {}, { maxRetries }, noDelay),
          ).rejects.toThrow();

          expect(fetchSpy).toHaveBeenCalledTimes(maxRetries + 1);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('does not retry on any 2xx status code — fetch is called exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200, max: 299 }),
        fc.integer({ min: 1, max: 5 }),
        async (statusCode, maxRetries) => {
          fetchSpy.mockReset();
          fetchSpy.mockResolvedValue(mockResponse(statusCode));

          const res = await fetchWithRetry(
            '/api/test',
            {},
            { maxRetries },
            noDelay,
          );

          expect(res.status).toBe(statusCode);
          expect(fetchSpy).toHaveBeenCalledTimes(1);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('total attempts never exceed maxRetries + 1 for any status code', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 200, max: 599 }),
        fc.integer({ min: 0, max: 5 }),
        async (statusCode, maxRetries) => {
          fetchSpy.mockReset();
          fetchSpy.mockResolvedValue(mockResponse(statusCode));

          await fetchWithRetry('/api/test', {}, { maxRetries }, noDelay);

          expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(
            maxRetries + 1,
          );
        },
      ),
      { numRuns: 20 },
    );
  });
});
