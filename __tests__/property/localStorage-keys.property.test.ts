import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { STORAGE_PREFIX, storageKey } from '@/lib/storage-keys';

/**
 * Feature: static-to-dynamic-conversion
 * Property 14: localStorage key prefix construction
 *
 * For any configured prefix string and any key name, constructing a localStorage
 * key should produce a string equal to `prefix + keyName`, with no other
 * characters inserted or omitted.
 *
 * **Validates: Requirements 14.2**
 */

/** Arbitrary for valid localStorage key names (non-empty strings). */
const keyNameArb = fc.string({ minLength: 1, maxLength: 50 });

describe('Property 14: localStorage key prefix construction', () => {
  it('storageKey(keyName) always equals STORAGE_PREFIX + keyName for any random key name', () => {
    fc.assert(
      fc.property(keyNameArb, (keyName) => {
        const result = storageKey(keyName);
        expect(result).toBe(STORAGE_PREFIX + keyName);
      }),
      { numRuns: 20 },
    );
  });

  it('result length equals STORAGE_PREFIX.length + keyName.length', () => {
    fc.assert(
      fc.property(keyNameArb, (keyName) => {
        const result = storageKey(keyName);
        expect(result.length).toBe(STORAGE_PREFIX.length + keyName.length);
      }),
      { numRuns: 20 },
    );
  });

  it('result starts with STORAGE_PREFIX and ends with keyName', () => {
    fc.assert(
      fc.property(keyNameArb, (keyName) => {
        const result = storageKey(keyName);
        expect(result.startsWith(STORAGE_PREFIX)).toBe(true);
        expect(result.endsWith(keyName)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});
