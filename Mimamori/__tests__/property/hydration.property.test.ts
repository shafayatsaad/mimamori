import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { calculateHydrationGoal, validateIntakeAmount, shouldShowLowHydrationWarning } from '@/lib/hydration';

/**
 * Feature: static-to-dynamic-conversion
 * Property 5: Hydration goal uses configurable thresholds
 *
 * *For any* temperature value and any optional Care_Plan hydration config
 * (hotTemp, warmTemp, hotGoalMl, warmGoalMl, coldGoalMl),
 * `calculateHydrationGoal` should return `hotGoalMl` when temperature > hotTemp,
 * `warmGoalMl` when warmTemp <= temperature <= hotTemp, and `coldGoalMl` when
 * temperature < warmTemp. When no Care_Plan config is provided, the system
 * defaults (28, 20, 2500, 2000, 1500) should be used.
 *
 * **Validates: Requirements 4.1, 4.2**
 */

/**
 * Arbitrary that generates a valid hydration config where warmTemp < hotTemp,
 * and each goal is a positive integer.
 */
const hydrationConfigArb = fc
  .tuple(
    fc.double({ min: -40, max: 60, noNaN: true }),
    fc.double({ min: -40, max: 60, noNaN: true }),
  )
  .filter(([a, b]) => a !== b)
  .chain(([a, b]) => {
    const warmTemp = Math.min(a, b);
    const hotTemp = Math.max(a, b);
    return fc.tuple(
      fc.constant(warmTemp),
      fc.constant(hotTemp),
      fc.integer({ min: 100, max: 5000 }), // hotGoalMl
      fc.integer({ min: 100, max: 5000 }), // warmGoalMl
      fc.integer({ min: 100, max: 5000 }), // coldGoalMl
    );
  })
  .map(([warmTemp, hotTemp, hotGoalMl, warmGoalMl, coldGoalMl]) => ({
    warmTemp,
    hotTemp,
    hotGoalMl,
    warmGoalMl,
    coldGoalMl,
  }));

describe('Property 5: Hydration goal uses configurable thresholds', () => {
  it('returns hotGoalMl when temperature > hotTemp', () => {
    fc.assert(
      fc.property(hydrationConfigArb, (config) => {
        // Pick a temperature strictly above hotTemp
        const temperature = config.hotTemp + 0.1;
        const goal = calculateHydrationGoal(temperature, config);
        expect(goal).toBe(config.hotGoalMl);
      }),
      { numRuns: 20 },
    );
  });

  it('returns warmGoalMl when warmTemp <= temperature <= hotTemp', () => {
    fc.assert(
      fc.property(
        hydrationConfigArb.chain((config) =>
          fc
            .double({ min: config.warmTemp, max: config.hotTemp, noNaN: true })
            .map((temp) => ({ config, temperature: temp })),
        ),
        ({ config, temperature }) => {
          const goal = calculateHydrationGoal(temperature, config);
          expect(goal).toBe(config.warmGoalMl);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns coldGoalMl when temperature < warmTemp', () => {
    fc.assert(
      fc.property(hydrationConfigArb, (config) => {
        // Pick a temperature strictly below warmTemp
        const temperature = config.warmTemp - 0.1;
        const goal = calculateHydrationGoal(temperature, config);
        expect(goal).toBe(config.coldGoalMl);
      }),
      { numRuns: 20 },
    );
  });

  it('always returns exactly one of the three configured goals for any temperature', () => {
    fc.assert(
      fc.property(
        hydrationConfigArb,
        fc.double({ min: -50, max: 70, noNaN: true }),
        (config, temperature) => {
          const goal = calculateHydrationGoal(temperature, config);
          expect([config.hotGoalMl, config.warmGoalMl, config.coldGoalMl]).toContain(goal);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('uses system defaults (28, 20, 2500, 2000, 1500) when no config is provided and AWS env vars are set', () => {
    // Set required AWS env vars so getConfig() doesn't throw
    const requiredEnvVars: Record<string, string> = {
      APP_S3_BUCKET_NAME: 'test-bucket',
      APP_SES_FROM_EMAIL: 'test@example.com',
      APP_BEDROCK_ROUTER_ARN: 'arn:aws:bedrock:us-west-2:000000000000:router/test',
      MIMAMORI_USERS_TABLE: 'TestUsers',
      MIMAMORI_DATA_TABLE: 'TestData',
    };

    const originalEnv = { ...process.env };

    // Clear any hydration env overrides so defaults are used
    delete process.env.HYDRATION_HOT_TEMP;
    delete process.env.HYDRATION_WARM_TEMP;
    delete process.env.HYDRATION_HOT_GOAL_ML;
    delete process.env.HYDRATION_WARM_GOAL_ML;
    delete process.env.HYDRATION_COLD_GOAL_ML;

    // Set required AWS env vars
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      process.env[key] = value;
    }

    try {
      fc.assert(
        fc.property(fc.double({ min: -50, max: 60, noNaN: true }), (temperature) => {
          const goal = calculateHydrationGoal(temperature);

          if (temperature > 28) {
            expect(goal).toBe(2500);
          } else if (temperature >= 20) {
            expect(goal).toBe(2000);
          } else {
            expect(goal).toBe(1500);
          }
        }),
        { numRuns: 20 },
      );
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });
});


/**
 * Feature: static-to-dynamic-conversion
 * Property 6: Intake validation uses configurable bounds
 *
 * *For any* numeric amount and any optional bounds config (min, max where min <= max),
 * `validateIntakeAmount` should return true if and only if the amount is a finite number
 * within [min, max]. When no bounds config is provided, the defaults (50, 2000) should be used.
 *
 * **Validates: Requirements 5.1, 5.2**
 */

/**
 * Arbitrary that generates valid bounds where min <= max.
 */
const boundsArb = fc
  .tuple(
    fc.double({ min: 0, max: 10000, noNaN: true }),
    fc.double({ min: 0, max: 10000, noNaN: true }),
  )
  .map(([a, b]) => ({
    min: Math.min(a, b),
    max: Math.max(a, b),
  }));

describe('Property 6: Intake validation uses configurable bounds', () => {
  it('returns true when amount is finite and within [min, max]', () => {
    fc.assert(
      fc.property(
        boundsArb.filter((b) => b.min < b.max).chain((bounds) =>
          fc
            .double({ min: bounds.min, max: bounds.max, noNaN: true })
            .map((amount) => ({ bounds, amount })),
        ),
        ({ bounds, amount }) => {
          expect(validateIntakeAmount(amount, bounds)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns false when amount is below min', () => {
    fc.assert(
      fc.property(
        boundsArb.filter((b) => b.min > 1).chain((bounds) =>
          fc
            .double({ min: 0, max: bounds.min - Number.EPSILON, noNaN: true })
            .filter((a) => a < bounds.min)
            .map((amount) => ({ bounds, amount })),
        ),
        ({ bounds, amount }) => {
          expect(validateIntakeAmount(amount, bounds)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns false when amount is above max', () => {
    fc.assert(
      fc.property(
        boundsArb.filter((b) => b.max < 9999).chain((bounds) =>
          fc
            .double({ min: bounds.max + Number.EPSILON, max: 10000, noNaN: true })
            .filter((a) => a > bounds.max)
            .map((amount) => ({ bounds, amount })),
        ),
        ({ bounds, amount }) => {
          expect(validateIntakeAmount(amount, bounds)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns false for non-finite amounts (NaN, Infinity, -Infinity)', () => {
    fc.assert(
      fc.property(
        boundsArb,
        fc.constantFrom(NaN, Infinity, -Infinity),
        (bounds, amount) => {
          expect(validateIntakeAmount(amount, bounds)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns true when amount equals min (boundary)', () => {
    fc.assert(
      fc.property(boundsArb, (bounds) => {
        expect(validateIntakeAmount(bounds.min, bounds)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('returns true when amount equals max (boundary)', () => {
    fc.assert(
      fc.property(boundsArb, (bounds) => {
        expect(validateIntakeAmount(bounds.max, bounds)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('uses system defaults (50, 2000) when no bounds are provided and AWS env vars are set', () => {
    const requiredEnvVars: Record<string, string> = {
      APP_S3_BUCKET_NAME: 'test-bucket',
      APP_SES_FROM_EMAIL: 'test@example.com',
      APP_BEDROCK_ROUTER_ARN: 'arn:aws:bedrock:us-west-2:000000000000:router/test',
      MIMAMORI_USERS_TABLE: 'TestUsers',
      MIMAMORI_DATA_TABLE: 'TestData',
    };

    const originalEnv = { ...process.env };

    // Clear any intake env overrides so defaults are used
    delete process.env.INTAKE_MIN_ML;
    delete process.env.INTAKE_MAX_ML;

    // Set required AWS env vars
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      process.env[key] = value;
    }

    try {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: 5000, noNaN: true }),
          (amount) => {
            const result = validateIntakeAmount(amount);
            const expected = Number.isFinite(amount) && amount >= 50 && amount <= 2000;
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 20 },
      );
    } finally {
      process.env = originalEnv;
    }
  });
});


/**
 * Feature: static-to-dynamic-conversion
 * Property 7: Low-hydration warning uses configurable parameters
 *
 * *For any* combination of (consumed, goal, currentHour, userType, triggerHour, percentThreshold),
 * `shouldShowLowHydrationWarning` should return true if and only if userType is 'Caregiver'
 * AND currentHour >= triggerHour AND consumed < goal * (percentThreshold / 100).
 * When no custom parameters are provided, defaults (hour=15, percent=50) should be used.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

/**
 * Arbitrary that generates configurable warning parameters.
 */
const warningParamsArb = fc.record({
  triggerHour: fc.integer({ min: 0, max: 23 }),
  percentThreshold: fc.integer({ min: 1, max: 100 }),
});

const userTypeArb = fc.oneof(
  fc.constant('Caregiver'),
  fc.constant('Patient'),
  fc.constant('Admin'),
  fc.constant('Nurse'),
);

describe('Property 7: Low-hydration warning uses configurable parameters', () => {
  it('returns correct boolean for any (consumed, goal, hour, userType, params) tuple', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),   // consumed
        fc.double({ min: 1, max: 10000, noNaN: true }),   // goal (positive)
        fc.integer({ min: 0, max: 23 }),                   // currentHour
        userTypeArb,                                        // userType
        warningParamsArb,                                   // params
        (consumed, goal, currentHour, userType, params) => {
          const result = shouldShowLowHydrationWarning(consumed, goal, currentHour, userType, params);
          const expected =
            userType === 'Caregiver' &&
            currentHour >= params.triggerHour &&
            consumed < goal * (params.percentThreshold / 100);
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns false for non-Caregiver users regardless of other parameters', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.integer({ min: 0, max: 23 }),
        fc.oneof(fc.constant('Patient'), fc.constant('Admin'), fc.constant('Nurse')),
        warningParamsArb,
        (consumed, goal, currentHour, userType, params) => {
          const result = shouldShowLowHydrationWarning(consumed, goal, currentHour, userType, params);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns false when currentHour is before triggerHour', () => {
    fc.assert(
      fc.property(
        warningParamsArb.filter((p) => p.triggerHour > 0).chain((params) =>
          fc.integer({ min: 0, max: params.triggerHour - 1 }).map((hour) => ({ params, hour })),
        ),
        ({ params, hour }) => {
          // consumed=0 is well below any threshold, so only the hour check matters
          const result = shouldShowLowHydrationWarning(0, 2000, hour, 'Caregiver', params);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns false when consumed meets or exceeds threshold percentage of goal', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 10000, noNaN: true }),   // goal
        warningParamsArb,
        (goal, params) => {
          // consumed exactly at threshold → should NOT trigger warning
          const threshold = goal * (params.percentThreshold / 100);
          const result = shouldShowLowHydrationWarning(threshold, goal, 23, 'Caregiver', params);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('uses system defaults (hour=15, percent=50) when no params are provided and AWS env vars are set', () => {
    const requiredEnvVars: Record<string, string> = {
      APP_S3_BUCKET_NAME: 'test-bucket',
      APP_SES_FROM_EMAIL: 'test@example.com',
      APP_BEDROCK_ROUTER_ARN: 'arn:aws:bedrock:us-west-2:000000000000:router/test',
      MIMAMORI_USERS_TABLE: 'TestUsers',
      MIMAMORI_DATA_TABLE: 'TestData',
    };

    const originalEnv = { ...process.env };

    // Clear any low-hydration env overrides so defaults are used
    delete process.env.LOW_HYDRATION_HOUR;
    delete process.env.LOW_HYDRATION_PERCENT;

    // Set required AWS env vars
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      process.env[key] = value;
    }

    try {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 5000, noNaN: true }),
          fc.double({ min: 1, max: 5000, noNaN: true }),
          fc.integer({ min: 0, max: 23 }),
          userTypeArb,
          (consumed, goal, currentHour, userType) => {
            const result = shouldShowLowHydrationWarning(consumed, goal, currentHour, userType);
            const expected =
              userType === 'Caregiver' &&
              currentHour >= 15 &&
              consumed < goal * 0.5;
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 20 },
      );
    } finally {
      process.env = originalEnv;
    }
  });
});
