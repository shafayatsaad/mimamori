import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';

// Feature: mimamori-reliability-audit, Property 24: Email retry exponential backoff timing

/**
 * Property 24: Email retry exponential backoff timing
 *
 * For any sequence of SES send failures, sendEmailWithRetry with maxRetries=3
 * should attempt exactly 4 sends total, with delays of approximately 1s, 2s,
 * and 4s between attempts (exponential backoff with base 1000ms and factor
 * 2^attempt).
 *
 * **Validates: Requirements 13.1**
 */

// --- Mock SES client and SendEmailCommand ---

const mockSend = vi.fn();
const mockSesClient = { send: (...args: unknown[]) => mockSend(...args) };
class MockSendEmailCommand {
  constructor(public input: unknown) {}
}

beforeAll(() => {
  (globalThis as any).sesClient = mockSesClient;
  (globalThis as any).SendEmailCommand = MockSendEmailCommand;
});

afterAll(() => {
  delete (globalThis as any).sesClient;
  delete (globalThis as any).SendEmailCommand;
});

import { sendEmailWithRetry } from '@/lib/email-retry';

// --- Helpers ---

const DUMMY_PARAMS: any = {
  Source: 'sender@example.com',
  Destination: { ToAddresses: ['recipient@example.com'] },
  Message: {
    Subject: { Data: 'Test Subject' },
    Body: { Text: { Data: 'Test Body' } },
  },
};

function createDelayTracker() {
  const delays: number[] = [];
  const delayFn = (ms: number): Promise<void> => {
    delays.push(ms);
    return Promise.resolve();
  };
  return { delays, delayFn };
}

describe('Property 24: Email retry exponential backoff timing', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('on persistent failure with maxRetries=3, exactly 4 total SES send attempts are made', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (errorMessage) => {
          mockSend.mockReset();
          mockSend.mockRejectedValue(new Error(errorMessage));
          const { delayFn } = createDelayTracker();

          const result = await sendEmailWithRetry(DUMMY_PARAMS, 3, delayFn);

          expect(result.success).toBe(false);
          expect(mockSend).toHaveBeenCalledTimes(4);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('delay function is called with 1000, 2000, 4000 (exponential backoff)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (errorMessage) => {
          mockSend.mockReset();
          mockSend.mockRejectedValue(new Error(errorMessage));
          const { delays, delayFn } = createDelayTracker();

          await sendEmailWithRetry(DUMMY_PARAMS, 3, delayFn);

          expect(delays).toEqual([1000, 2000, 4000]);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('on success at attempt N, exactly N SES send attempts are made and N-1 delays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }),
        async (successAttempt) => {
          mockSend.mockReset();
          let callCount = 0;
          mockSend.mockImplementation(() => {
            callCount++;
            if (callCount < successAttempt) {
              return Promise.reject(new Error(`Failure #${callCount}`));
            }
            return Promise.resolve({ MessageId: `msg-${callCount}` });
          });
          const { delays, delayFn } = createDelayTracker();

          const result = await sendEmailWithRetry(DUMMY_PARAMS, 3, delayFn);

          expect(result.success).toBe(true);
          expect(mockSend).toHaveBeenCalledTimes(successAttempt);
          expect(delays).toHaveLength(successAttempt - 1);
          for (let i = 0; i < successAttempt - 1; i++) {
            expect(delays[i]).toBe(1000 * Math.pow(2, i));
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('result is { success: false, error: ... } after all retries exhausted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          mockSend.mockReset();
          mockSend.mockRejectedValue(new Error(errorMessage));
          const { delayFn } = createDelayTracker();

          const result = await sendEmailWithRetry(DUMMY_PARAMS, 3, delayFn);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(typeof result.error).toBe('string');
            expect(result.error).toBe(errorMessage);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
