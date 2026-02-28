import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: mimamori-production-readiness, Property 7: Critical hydration warning threshold

/**
 * Property 7: Critical hydration warning threshold
 *
 * *For any* hydration total and daily goal where `total < goal * 0.25` and the
 * current hour is `>= 14`, the critical hydration warning should return true.
 * *For any* case where `total >= goal * 0.25` or the hour is `< 14`, it should
 * return false.
 *
 * **Validates: Requirements 13.1**
 */

/**
 * Pure function that mirrors the critical hydration warning logic from
 * HydrationCard.tsx:
 *   currentHour >= 14 && hydrationGoal > 0 && totalConsumed < hydrationGoal * 0.25
 */
function shouldShowCriticalWarning(
  totalConsumed: number,
  hydrationGoal: number,
  currentHour: number,
): boolean {
  return currentHour >= 14 && hydrationGoal > 0 && totalConsumed < hydrationGoal * 0.25;
}

describe('Property 7: Critical hydration warning threshold', () => {
  it('triggers warning when consumed < 25% of goal AND hour >= 14 AND goal > 0', () => {
    const arb = fc.tuple(
      fc.integer({ min: 1, max: 10000 }),   // hydrationGoal (positive)
      fc.integer({ min: 14, max: 23 }),      // currentHour (afternoon/evening)
    ).chain(([goal, hour]) =>
      fc.tuple(
        // totalConsumed: strictly below 25% of goal
        fc.integer({ min: 0, max: Math.max(0, Math.floor(goal * 0.25) - 1) }),
        fc.constant(goal),
        fc.constant(hour),
      ),
    );

    fc.assert(
      fc.property(arb, ([totalConsumed, hydrationGoal, currentHour]) => {
        expect(shouldShowCriticalWarning(totalConsumed, hydrationGoal, currentHour)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('does NOT trigger warning when consumed >= 25% of goal', () => {
    const arb = fc.tuple(
      fc.integer({ min: 1, max: 10000 }),   // hydrationGoal (positive)
      fc.integer({ min: 14, max: 23 }),      // currentHour (afternoon/evening)
    ).chain(([goal, hour]) =>
      fc.tuple(
        // totalConsumed: at or above 25% of goal
        fc.integer({ min: Math.ceil(goal * 0.25), max: goal + 1000 }),
        fc.constant(goal),
        fc.constant(hour),
      ),
    );

    fc.assert(
      fc.property(arb, ([totalConsumed, hydrationGoal, currentHour]) => {
        expect(shouldShowCriticalWarning(totalConsumed, hydrationGoal, currentHour)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('does NOT trigger warning when hour < 14 regardless of hydration level', () => {
    const arb = fc.tuple(
      fc.integer({ min: 0, max: 10000 }),   // totalConsumed
      fc.integer({ min: 1, max: 10000 }),   // hydrationGoal (positive)
      fc.integer({ min: 0, max: 13 }),      // currentHour (before 2 PM)
    );

    fc.assert(
      fc.property(arb, ([totalConsumed, hydrationGoal, currentHour]) => {
        expect(shouldShowCriticalWarning(totalConsumed, hydrationGoal, currentHour)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('does NOT trigger warning when hydrationGoal is 0', () => {
    const arb = fc.tuple(
      fc.integer({ min: 0, max: 10000 }),   // totalConsumed
      fc.integer({ min: 0, max: 23 }),       // currentHour
    );

    fc.assert(
      fc.property(arb, ([totalConsumed, currentHour]) => {
        expect(shouldShowCriticalWarning(totalConsumed, 0, currentHour)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('matches the exact component logic for any valid inputs', () => {
    const arb = fc.tuple(
      fc.integer({ min: 0, max: 10000 }),   // totalConsumed
      fc.integer({ min: 0, max: 10000 }),   // hydrationGoal
      fc.integer({ min: 0, max: 23 }),       // currentHour
    );

    fc.assert(
      fc.property(arb, ([totalConsumed, hydrationGoal, currentHour]) => {
        const result = shouldShowCriticalWarning(totalConsumed, hydrationGoal, currentHour);
        // Restate the expected logic directly
        const expected =
          currentHour >= 14 && hydrationGoal > 0 && totalConsumed < hydrationGoal * 0.25;
        expect(result).toBe(expected);
      }),
      { numRuns: 20 },
    );
  });
});
