import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Feature: mimamori-production-readiness, Property 6: Email retry with exponential backoff

/**
 * Property 6: Email retry with exponential backoff
 *
 * *For any* SES send operation that fails transiently, `sendEmailWithRetry`
 * should attempt exactly `maxRetries + 1` total calls (1 initial + maxRetries
 * retries), and the cumulative delay should equal the sum of the exponential
 * backoff intervals (1000 * 2^i for each retry i).
 *
 * **Validates: Requirements 9.1**
 */

// --- Mock SES client ---

const mockSend = vi.fn();

vi.mock('@/lib/aws-clients', () => ({
  sesClient: { send: (...args: unknown[]) => mockSend(...args) },
}));

// Import after mock is set up
import { sendEmailWithRetry } from '@/lib/email-retry';
import type { SendEmailCommandInput } from '@aws-sdk/client-ses';

// --- Helpers ---

/** Minimal valid SES params for testing. */
const DUMMY_PARAMS: SendEmailCommandInput = {
  Source: 'test@example.com',
  Destination: { ToAddresses: ['user@example.com'] },
  Message: {
    Subject: { Data: 'Test' },
    Body: { Text: { Data: 'Hello' } },
  },
};

/**
 * Configures mockSend to fail `failureCount` times then succeed.
 * Returns a fresh call counter each time.
 */
function setupMockSend(failureCount: number) {
  let callCount = 0;
  mockSend.mockReset();
  mockSend.mockImplementation(() => {
    callCount++;
    if (callCount <= failureCount) {
      return Promise.reject(new Error(`SES failure #${callCount}`));
    }
    return Promise.resolve({ MessageId: `msg-${callCount}` });
  });
}

/** Creates a delay tracker that records each delay without actually waiting. */
function createDelayTracker() {
  const delays: number[] = [];
  const delayFn = (ms: number): Promise<void> => {
    delays.push(ms);
    return Promise.resolve();
  };
  return { delays, delayFn };
}

describe('Property 6: Email retry with exponential backoff', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('when failureCount <= maxRetries: succeeds with exactly failureCount + 1 calls and correct delays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),  // maxRetries
        fc.integer({ min: 0, max: 5 }),  // rawFailureCount
        async (maxRetries, rawFailureCount) => {
          // Ensure failureCount <= maxRetries for the success path
          const failureCount = Math.min(rawFailureCount, maxRetries);

          setupMockSend(failureCount);
          const { delays, delayFn } = createDelayTracker();

          const result = await sendEmailWithRetry(DUMMY_PARAMS, maxRetries, delayFn);

          // Should succeed
          expect(result.success).toBe(true);

          // Total calls = failureCount (failures) + 1 (success)
          expect(mockSend).toHaveBeenCalledTimes(failureCount + 1);

          // Delays: one per failed attempt before retry
          expect(delays).toHaveLength(failureCount);
          for (let i = 0; i < failureCount; i++) {
            expect(delays[i]).toBe(1000 * Math.pow(2, i));
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('when failureCount > maxRetries: fails with exactly maxRetries + 1 calls and correct delays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),  // maxRetries
        async (maxRetries) => {
          // All attempts fail
          setupMockSend(maxRetries + 1);
          const { delays, delayFn } = createDelayTracker();

          const result = await sendEmailWithRetry(DUMMY_PARAMS, maxRetries, delayFn);

          // Should fail
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(typeof result.error).toBe('string');
            expect(result.error.length).toBeGreaterThan(0);
          }

          // Total calls = maxRetries + 1
          expect(mockSend).toHaveBeenCalledTimes(maxRetries + 1);

          // Delays: one per failed attempt except the last (no delay after final failure)
          expect(delays).toHaveLength(maxRetries);
          for (let i = 0; i < maxRetries; i++) {
            expect(delays[i]).toBe(1000 * Math.pow(2, i));
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('cumulative delay equals sum of 1000 * 2^i for i = 0 to min(failureCount, maxRetries) - 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),  // maxRetries
        fc.integer({ min: 0, max: 6 }),  // failureCount
        async (maxRetries, failureCount) => {
          setupMockSend(failureCount);
          const { delays, delayFn } = createDelayTracker();

          await sendEmailWithRetry(DUMMY_PARAMS, maxRetries, delayFn);

          // Number of delays = min(failureCount, maxRetries)
          const expectedDelayCount = Math.min(failureCount, maxRetries);
          expect(delays).toHaveLength(expectedDelayCount);

          // Cumulative delay = sum of 1000 * 2^i for i = 0..expectedDelayCount-1
          let expectedCumulative = 0;
          for (let i = 0; i < expectedDelayCount; i++) {
            expectedCumulative += 1000 * Math.pow(2, i);
          }
          const actualCumulative = delays.reduce((sum, d) => sum + d, 0);
          expect(actualCumulative).toBe(expectedCumulative);
        },
      ),
      { numRuns: 20 },
    );
  });
});
