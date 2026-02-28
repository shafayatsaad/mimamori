import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateHydrationGoal,
  validateIntakeAmount,
  computeHydrationAggregates,
  calculateProgressRatio,
  isGoalReached,
  shouldShowLowHydrationWarning,
  type IntakeLog,
} from '@/lib/hydration';

/**
 * Feature: dynamic-hydration-goals
 * Property 1: Temperature-to-goal mapping covers all ranges
 * Validates: Requirements 1.2, 1.3, 1.4
 */
describe('Property 1: Temperature-to-goal mapping covers all ranges', () => {
  const defaultConfig = { hotTemp: 28, warmTemp: 20, hotGoalMl: 2500, warmGoalMl: 2000, coldGoalMl: 1500 };

  it('returns 2500 when temperature > 28, 2000 when 20 <= temperature <= 28, 1500 when temperature < 20', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 60, noNaN: true }), (temperature) => {
        const goal = calculateHydrationGoal(temperature, defaultConfig);

        if (temperature > 28) {
          expect(goal).toBe(2500);
        } else if (temperature >= 20) {
          expect(goal).toBe(2000);
        } else {
          expect(goal).toBe(1500);
        }

        // Must always be one of the three valid values
        expect([1500, 2000, 2500]).toContain(goal);
      }),
      { numRuns: 20 },
    );
  });
});


/**
 * Feature: dynamic-hydration-goals
 * Property 2: Intake amount validation accepts valid and rejects invalid
 * Validates: Requirements 2.4, 2.6
 */
describe('Property 2: Intake amount validation accepts valid and rejects invalid', () => {
  const defaultBounds = { min: 50, max: 2000 };

  it('returns true iff amount is in [50, 2000]', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 5000 }), (amount) => {
        const result = validateIntakeAmount(amount, defaultBounds);
        const expected = amount >= 50 && amount <= 2000;
        expect(result).toBe(expected);
      }),
      { numRuns: 20 },
    );
  });
});

/**
 * Feature: dynamic-hydration-goals
 * Property 4: Computed hydration aggregates are consistent
 * Validates: Requirements 3.1, 3.5, 7.3
 */
describe('Property 4: Computed hydration aggregates are consistent', () => {
  it('returns correct sum and count for random arrays of positive integer amounts', () => {
    const logArb = fc.array(
      fc.integer({ min: 1, max: 5000 }).map((amount): IntakeLog => ({
        id: 'log-' + Math.random().toString(36).slice(2),
        amount,
        timestamp: new Date().toISOString(),
        date: '2025-01-15',
      })),
    );

    fc.assert(
      fc.property(logArb, (logs) => {
        const result = computeHydrationAggregates(logs);
        const expectedSum = logs.reduce((sum, log) => sum + log.amount, 0);

        expect(result.totalConsumed).toBe(expectedSum);
        expect(result.logCount).toBe(logs.length);
      }),
      { numRuns: 20 },
    );
  });
});

/**
 * Feature: dynamic-hydration-goals
 * Property 5: Progress ratio calculation
 * Validates: Requirements 3.3
 */
describe('Property 5: Progress ratio calculation', () => {
  it('returns consumed/goal clamped to [0, 1] for positive numbers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        (consumed, goal) => {
          const ratio = calculateProgressRatio(consumed, goal);

          expect(ratio).toBeGreaterThanOrEqual(0);
          expect(ratio).toBeLessThanOrEqual(1);

          const rawRatio = consumed / goal;
          const expectedClamped = Math.min(Math.max(rawRatio, 0), 1);
          expect(ratio).toBeCloseTo(expectedClamped, 10);
        },
      ),
      { numRuns: 20 },
    );
  });
});

/**
 * Feature: dynamic-hydration-goals
 * Property 6: Goal-reached condition
 * Validates: Requirements 3.4
 */
describe('Property 6: Goal-reached condition', () => {
  it('returns true iff consumed >= goal', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (consumed, goal) => {
          const result = isGoalReached(consumed, goal);
          expect(result).toBe(consumed >= goal);
        },
      ),
      { numRuns: 20 },
    );
  });
});

/**
 * Feature: dynamic-hydration-goals
 * Property 8: Low-hydration warning condition
 * Validates: Requirements 4.3
 */
describe('Property 8: Low-hydration warning condition', () => {
  const defaultParams = { triggerHour: 15, percentThreshold: 50 };

  it('returns true iff userType is Caregiver AND currentHour >= 15 AND consumed < goal * 0.5', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 0.01, max: 10000, noNaN: true }),
        fc.integer({ min: 0, max: 23 }),
        fc.oneof(fc.constant('Caregiver'), fc.constant('Patient'), fc.constant('Admin')),
        (consumed, goal, currentHour, userType) => {
          const result = shouldShowLowHydrationWarning(consumed, goal, currentHour, userType, defaultParams);
          const expected =
            userType === 'Caregiver' && currentHour >= 15 && consumed < goal * 0.5;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 20 },
    );
  });
});
