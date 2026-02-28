import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

/**
 * Feature: static-to-dynamic-conversion
 * Property 2: Password hash round trip
 *
 * For any non-empty password string, hashing it with the Password_Hasher and
 * then verifying the original password against the hash should return true,
 * verifying a different password should return false, and the hash should never
 * equal the original plaintext.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */

describe('Property 2: Password hash round trip', () => {
  const passwordArb = fc.string({ minLength: 1, maxLength: 50 });

  it('hash then verify with the same password returns true', async () => {
    await fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const hash = await hashPassword(password);
        const result = await verifyPassword(password, hash);
        expect(result).toBe(true);
      }),
      { numRuns: 10 },
    );
  }, 30_000);

  it('verify with a different password returns false', async () => {
    await fc.assert(
      fc.asyncProperty(
        passwordArb,
        passwordArb.filter((s) => s.length >= 1),
        async (password, otherPassword) => {
          fc.pre(password !== otherPassword);
          const hash = await hashPassword(password);
          const result = await verifyPassword(otherPassword, hash);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 10 },
    );
  }, 30_000);

  it('hash is never equal to the plaintext password', async () => {
    await fc.assert(
      fc.asyncProperty(passwordArb, async (password) => {
        const hash = await hashPassword(password);
        expect(hash).not.toBe(password);
      }),
      { numRuns: 10 },
    );
  }, 30_000);
});
