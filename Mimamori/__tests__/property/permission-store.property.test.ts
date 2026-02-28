import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: static-to-dynamic-conversion
 * Property 11: Permission store round trip
 *
 * For any set of permission type records inserted into the database,
 * querying the Permission_Store should return exactly those permission
 * type names.
 *
 * **Validates: Requirements 10.2**
 */

// Mock the prisma module before importing the module under test
const mockFindMany = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    permissionType: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

// Import after mock setup
import {
  getPermissionTypes,
  isValidPermission,
  DEFAULT_PERMISSIONS,
} from '@/lib/permissions';

/** Arbitrary for generating unique, non-empty permission name strings. */
const permissionNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => s.trim().length > 0,
);

/** Arbitrary for generating a non-empty set of unique permission names. */
const permissionSetArb = fc
  .uniqueArray(permissionNameArb, { minLength: 1, maxLength: 20 })
  .filter((arr) => arr.length > 0);

describe('Property 11: Permission store round trip', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('getPermissionTypes returns exactly the names from the database, sorted by name', async () => {
    await fc.assert(
      fc.asyncProperty(permissionSetArb, async (names) => {
        // Simulate DB rows returned by findMany (sorted by name asc, matching the orderBy)
        const sorted = [...names].sort();
        const rows = sorted.map((name) => ({ name }));
        mockFindMany.mockResolvedValueOnce(rows);

        const result = await getPermissionTypes();

        expect(result).toEqual(sorted);
      }),
      { numRuns: 20 },
    );
  });

  it('getPermissionTypes falls back to DEFAULT_PERMISSIONS when DB throws', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (errorMsg) => {
        mockFindMany.mockRejectedValueOnce(new Error(errorMsg));

        const result = await getPermissionTypes();

        expect(result).toEqual(DEFAULT_PERMISSIONS);
      }),
      { numRuns: 20 },
    );
  });

  it('getPermissionTypes falls back to DEFAULT_PERMISSIONS when DB returns empty array', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        mockFindMany.mockResolvedValueOnce([]);

        const result = await getPermissionTypes();

        expect(result).toEqual(DEFAULT_PERMISSIONS);
      }),
      { numRuns: 20 },
    );
  });

  it('isValidPermission returns true iff the name is in the valid set', () => {
    fc.assert(
      fc.property(
        permissionSetArb,
        permissionNameArb,
        (validSet, testName) => {
          const result = isValidPermission(testName, validSet);

          if (validSet.includes(testName)) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('isValidPermission always returns true for names drawn from the valid set', () => {
    fc.assert(
      fc.property(
        permissionSetArb.chain((set) =>
          fc.tuple(fc.constant(set), fc.constantFrom(...set)),
        ),
        ([validSet, name]) => {
          expect(isValidPermission(name, validSet)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});
