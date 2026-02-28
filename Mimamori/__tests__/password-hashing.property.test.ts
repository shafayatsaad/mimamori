import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// Feature: mimamori-reliability-audit, Property 15: Password hashing produces valid bcrypt hashes

/**
 * Property 15: Password hashing produces valid bcrypt hashes
 *
 * For any plaintext password, hashPassword should produce a string that is a
 * valid bcrypt hash (starts with $2a$ or $2b$) with a cost factor of at least 10,
 * and verifyPassword(plaintext, hash) should return true. The hash should never
 * equal the plaintext.
 *
 * **Validates: Requirements 26.1, 26.2, 26.3, 26.4**
 */

// Printable ASCII characters for password generation (avoids null bytes that bcrypt may reject)
const passwordArb = fc.string({
  minLength: 1,
  maxLength: 8,
  unit: fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)),
});

// bcrypt with cost factor 12 is slow (~250ms per hash), so we need generous timeouts
const TEST_TIMEOUT = 120_000;

describe('Property 15: Password hashing produces valid bcrypt hashes', () => {
  it(
    'produces a valid bcrypt hash starting with $2a$ or $2b$',
    async () => {
      await fc.assert(
        fc.asyncProperty(passwordArb, async (plaintext) => {
          const hash = await hashPassword(plaintext);
          expect(hash).toMatch(/^\$2[ab]\$/);
        }),
        { numRuns: 5 },
      );
    },
    TEST_TIMEOUT,
  );

  it(
    'uses a cost factor of at least 10',
    async () => {
      await fc.assert(
        fc.asyncProperty(passwordArb, async (plaintext) => {
          const hash = await hashPassword(plaintext);
          // bcrypt hash format: $2a$XX$... where XX is the cost factor
          const costMatch = hash.match(/^\$2[ab]\$(\d{2})\$/);
          expect(costMatch).not.toBeNull();
          const cost = parseInt(costMatch![1], 10);
          expect(cost).toBeGreaterThanOrEqual(10);
        }),
        { numRuns: 5 },
      );
    },
    TEST_TIMEOUT,
  );

  it(
    'verifyPassword returns true for the same plaintext',
    async () => {
      await fc.assert(
        fc.asyncProperty(passwordArb, async (plaintext) => {
          const hash = await hashPassword(plaintext);
          const result = await verifyPassword(plaintext, hash);
          expect(result).toBe(true);
        }),
        { numRuns: 5 },
      );
    },
    TEST_TIMEOUT,
  );

  it(
    'hash never equals the plaintext',
    async () => {
      await fc.assert(
        fc.asyncProperty(passwordArb, async (plaintext) => {
          const hash = await hashPassword(plaintext);
          expect(hash).not.toBe(plaintext);
        }),
        { numRuns: 5 },
      );
    },
    TEST_TIMEOUT,
  );

  it(
    'verifyPassword returns false for a different plaintext',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          passwordArb,
          passwordArb,
          async (password1, password2) => {
            // Only test when passwords are actually different
            fc.pre(password1 !== password2);
            const hash = await hashPassword(password1);
            const result = await verifyPassword(password2, hash);
            expect(result).toBe(false);
          },
        ),
        { numRuns: 5 },
      );
    },
    TEST_TIMEOUT,
  );
});
