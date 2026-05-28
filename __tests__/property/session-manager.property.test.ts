// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { createSessionWithExpiry, verifySession } from '@/lib/auth/session';

/**
 * Feature: static-to-dynamic-conversion
 * Property 3: JWT creation encodes correct expiry
 *
 * For any valid user payload and any positive integer expiry duration (in
 * seconds), creating a session token should produce a JWT whose decoded `exp`
 * claim equals `iat + expirySeconds`.
 *
 * **Validates: Requirements 3.1, 3.6**
 */

beforeAll(() => {
  // Set required env vars so getConfig() doesn't throw
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-pub-key';
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.SESSION_JWT_SECRET = 'test-secret-for-property-tests';
});

describe('Property 3: JWT creation encodes correct expiry', () => {
  const payloadArb = fc.record({
    sub: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    role: fc.constantFrom('patient', 'caregiver'),
  });

  const expiryArb = fc.integer({ min: 60, max: 86400 });

  it('decoded JWT has exp equal to iat + expirySeconds', async () => {
    await fc.assert(
      fc.asyncProperty(payloadArb, expiryArb, async (payload, expirySeconds) => {
        const token = await createSessionWithExpiry(payload, expirySeconds);
        const decoded = await verifySession(token);

        expect(decoded).not.toBeNull();
        expect(decoded!.exp).toBe(decoded!.iat + expirySeconds);
      }),
      { numRuns: 20 },
    );
  }, 60_000);
});

/**
 * Feature: static-to-dynamic-conversion
 * Property 4: Expired JWT is rejected
 *
 * For any JWT token whose `exp` claim is in the past, `verifySession` should
 * return null (rejection), regardless of the token's other contents.
 *
 * **Validates: Requirements 3.3**
 */

describe('Property 4: Expired JWT is rejected', () => {
  const payloadArb = fc.record({
    sub: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    role: fc.constantFrom('patient', 'caregiver'),
  });

  // Negative expiry values produce tokens that are already expired at creation time
  const negativeExpiryArb = fc.integer({ min: -3600, max: -1 });

  it('verifySession returns null for tokens created with negative (past) expiry', async () => {
    await fc.assert(
      fc.asyncProperty(payloadArb, negativeExpiryArb, async (payload, negativeExpiry) => {
        const token = await createSessionWithExpiry(payload, negativeExpiry);
        const result = await verifySession(token);

        expect(result).toBeNull();
      }),
      { numRuns: 20 },
    );
  }, 60_000);
});
