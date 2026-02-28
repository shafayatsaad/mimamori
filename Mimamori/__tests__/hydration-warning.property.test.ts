import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { shouldShowHydrationWarning } from '@/lib/hydration-warning';

/**
 * Feature: mimamori-reliability-audit, Property 5: Hydration critical warning logic
 *
 * For any combination of consumed amount, daily goal, and current hour,
 * the critical hydration warning should display if and only if
 * `consumed < goal * 0.25` AND `currentHour >= 14`.
 * The warning should never display when consumed >= 25% of goal,
 * and should never display before 2:00 PM regardless of hydration level.
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */
describe('Feature: mimamori-reliability-audit, Property 5: Hydration critical warning logic', () => {
  it('returns true iff consumed < goal * 0.25 AND currentHour >= 14', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        fc.integer({ min: 0, max: 23 }),
        (consumed, goal, currentHour) => {
          const result = shouldShowHydrationWarning(consumed, goal, currentHour);
          const expected = consumed < goal * 0.25 && currentHour >= 14;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('never displays when consumed >= 25% of goal regardless of time', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        fc.integer({ min: 0, max: 23 }),
        (goal, currentHour) => {
          // consumed is exactly 25% of goal
          const consumed = goal * 0.25;
          expect(shouldShowHydrationWarning(consumed, goal, currentHour)).toBe(false);

          // consumed is above 25% of goal
          const consumedAbove = goal * 0.25 + 1;
          expect(shouldShowHydrationWarning(consumedAbove, goal, currentHour)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('never displays before 2:00 PM regardless of hydration level', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        fc.integer({ min: 0, max: 13 }),
        (consumed, goal, currentHour) => {
          expect(shouldShowHydrationWarning(consumed, goal, currentHour)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});
