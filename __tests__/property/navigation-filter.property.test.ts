import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterNavigationItems, NavigationItem } from '@/lib/navigation';

/**
 * Feature: static-to-dynamic-conversion
 * Property 12: Navigation filtering by user type and permissions
 *
 * For any set of navigation items with visibility rules (visibleTo,
 * requiredPermissions) and any (userType, permissions) combination,
 * filtering the navigation should return only items where the userType
 * is in visibleTo and all requiredPermissions are satisfied by the
 * user's permissions.
 *
 * **Validates: Requirements 11.3**
 */

/** Pool of possible user types used across generators. */
const USER_TYPES = ['Patient', 'Caregiver'] as const;

/** Arbitrary for a non-empty alphanumeric permission string. */
const permissionArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,19}$/)
  .filter((s) => s.length > 0);

/** Arbitrary for a unique set of permissions. */
const permissionSetArb = fc.uniqueArray(permissionArb, { minLength: 0, maxLength: 8 });

/** Arbitrary for a user type. */
const userTypeArb = fc.constantFrom(...USER_TYPES);

/** Arbitrary for a single NavigationItem. */
const navigationItemArb = (allPermissions: string[]): fc.Arbitrary<NavigationItem> =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    href: fc.string({ minLength: 1, maxLength: 50 }).map((s) => `/${s}`),
    iconId: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    requiredPermissions: fc.subarray(allPermissions),
    visibleTo: fc.subarray([...USER_TYPES], { minLength: 0, maxLength: 2 }),
    order: fc.integer({ min: 0, max: 100 }),
  });

/** Arbitrary that generates a coherent test scenario: nav items, user type, and permissions. */
const scenarioArb = permissionSetArb.chain((allPerms) =>
  fc.tuple(
    fc.array(navigationItemArb(allPerms), { minLength: 0, maxLength: 10 }),
    userTypeArb,
    fc.subarray(allPerms),
  ),
);

describe('Property 12: Navigation filtering by user type and permissions', () => {
  it('returns only items where userType is in visibleTo and permissions are satisfied', () => {
    fc.assert(
      fc.property(scenarioArb, ([items, userType, permissions]) => {
        const result = filterNavigationItems(items, userType, permissions);

        // Every returned item must satisfy visibility and permission rules
        for (const item of result) {
          // userType must be in visibleTo
          expect(item.visibleTo).toContain(userType);

          // For caregivers, all requiredPermissions must be present
          if (userType === 'Caregiver' && item.requiredPermissions.length > 0) {
            for (const perm of item.requiredPermissions) {
              expect(permissions).toContain(perm);
            }
          }
        }

        // Every item NOT returned must violate at least one rule
        const excluded = items.filter((item) => !result.includes(item));
        for (const item of excluded) {
          const isVisible = item.visibleTo.includes(userType);
          const hasPerms =
            userType !== 'Caregiver' ||
            item.requiredPermissions.length === 0 ||
            item.requiredPermissions.every((p) => permissions.includes(p));

          // At least one condition must be false for excluded items
          expect(isVisible && hasPerms).toBe(false);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('returns all items when userType is in visibleTo for non-Caregiver (permissions ignored)', () => {
    fc.assert(
      fc.property(
        permissionSetArb.chain((allPerms) =>
          fc.tuple(
            fc.array(navigationItemArb(allPerms), { minLength: 1, maxLength: 10 }),
            fc.constant('Patient' as const),
          ),
        ),
        ([items, userType]) => {
          // Patient should see all items where Patient is in visibleTo,
          // regardless of requiredPermissions
          const result = filterNavigationItems(items, userType, []);

          const expected = items.filter((item) => item.visibleTo.includes('Patient'));
          expect(result).toEqual(expected);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('caregiver with all permissions sees all items visible to Caregiver', () => {
    fc.assert(
      fc.property(
        permissionSetArb.chain((allPerms) =>
          fc.tuple(
            fc.array(navigationItemArb(allPerms), { minLength: 1, maxLength: 10 }),
            fc.constant(allPerms),
          ),
        ),
        ([items, allPerms]) => {
          const result = filterNavigationItems(items, 'Caregiver', allPerms);

          const expected = items.filter((item) =>
            item.visibleTo.includes('Caregiver'),
          );
          expect(result).toEqual(expected);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('caregiver with no permissions only sees items with no requiredPermissions', () => {
    fc.assert(
      fc.property(
        permissionSetArb.chain((allPerms) =>
          fc.array(navigationItemArb(allPerms), { minLength: 1, maxLength: 10 }),
        ),
        (items) => {
          const result = filterNavigationItems(items, 'Caregiver', []);

          const expected = items.filter(
            (item) =>
              item.visibleTo.includes('Caregiver') &&
              item.requiredPermissions.length === 0,
          );
          expect(result).toEqual(expected);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('filtering preserves the original order of items', () => {
    fc.assert(
      fc.property(scenarioArb, ([items, userType, permissions]) => {
        const result = filterNavigationItems(items, userType, permissions);

        // Result should be a subsequence of items (same relative order)
        let lastIndex = -1;
        for (const item of result) {
          const idx = items.indexOf(item, lastIndex + 1);
          expect(idx).toBeGreaterThan(lastIndex);
          lastIndex = idx;
        }
      }),
      { numRuns: 20 },
    );
  });
});
