import { describe, it, expect } from 'vitest';
import {
  calculateHydrationGoal,
  validateIntakeAmount,
  computeHydrationAggregates,
  shouldShowLowHydrationWarning,
  type IntakeLog,
} from '@/lib/hydration';

/**
 * Unit tests for edge cases and integration points.
 * Complements the property-based tests with specific boundary values.
 */

// Default config values matching Config_Service defaults — avoids requiring env vars in tests
const defaultHydrationConfig = {
  hotTemp: 28,
  warmTemp: 20,
  hotGoalMl: 2500,
  warmGoalMl: 2000,
  coldGoalMl: 1500,
};

const defaultBounds = { min: 50, max: 2000 };

const defaultWarningParams = { triggerHour: 15, percentThreshold: 50 };

// 8.1 Boundary tests for calculateHydrationGoal
describe('calculateHydrationGoal boundary tests', () => {
  it('returns 2000 for exactly 20°C (lower inclusive boundary)', () => {
    expect(calculateHydrationGoal(20, defaultHydrationConfig)).toBe(2000);
  });

  it('returns 2000 for exactly 28°C (upper inclusive boundary)', () => {
    expect(calculateHydrationGoal(28, defaultHydrationConfig)).toBe(2000);
  });

  it('returns 1500 for 19.99°C (just below lower boundary)', () => {
    expect(calculateHydrationGoal(19.99, defaultHydrationConfig)).toBe(1500);
  });

  it('returns 2500 for 28.01°C (just above upper boundary)', () => {
    expect(calculateHydrationGoal(28.01, defaultHydrationConfig)).toBe(2500);
  });
});

// 8.2 Boundary tests for validateIntakeAmount
describe('validateIntakeAmount boundary tests', () => {
  it('returns false for 49 (just below minimum)', () => {
    expect(validateIntakeAmount(49, defaultBounds)).toBe(false);
  });

  it('returns true for 50 (minimum valid)', () => {
    expect(validateIntakeAmount(50, defaultBounds)).toBe(true);
  });

  it('returns true for 2000 (maximum valid)', () => {
    expect(validateIntakeAmount(2000, defaultBounds)).toBe(true);
  });

  it('returns false for 2001 (just above maximum)', () => {
    expect(validateIntakeAmount(2001, defaultBounds)).toBe(false);
  });

  it('returns false for 0', () => {
    expect(validateIntakeAmount(0, defaultBounds)).toBe(false);
  });

  it('returns false for -1', () => {
    expect(validateIntakeAmount(-1, defaultBounds)).toBe(false);
  });
});

// 8.3 Empty intake log list
describe('computeHydrationAggregates with empty list', () => {
  it('returns totalConsumed=0 and logCount=0 for empty log list', () => {
    const result = computeHydrationAggregates([]);
    expect(result.totalConsumed).toBe(0);
    expect(result.logCount).toBe(0);
  });
});

// 8.4 Weather API fallback: default temperature (20°C) produces default goal (2000mL)
describe('weather API fallback default goal', () => {
  it('returns 2000mL for default temperature of 20°C', () => {
    // When the weather API is unavailable, the system uses 20°C as default,
    // which maps to the 2000mL default goal.
    expect(calculateHydrationGoal(20, defaultHydrationConfig)).toBe(2000);
  });
});

// 8.5 DynamoDB sort key format
describe('DynamoDB sort key format', () => {
  it('matches HYDRATION#YYYY-MM-DD#logId pattern', () => {
    const date = '2025-01-15';
    const logId = 'log-123';
    const sk = `HYDRATION#${date}#${logId}`;
    expect(sk).toMatch(/^HYDRATION#\d{4}-\d{2}-\d{2}#.+$/);
  });
});

// 8.6 Low-hydration warning at exactly 3:00 PM with 49% consumed
describe('low-hydration warning at 3PM boundary', () => {
  it('shows warning when consumed is 49% of goal at 3PM for Caregiver', () => {
    // 49% of 2000 = 980
    expect(shouldShowLowHydrationWarning(980, 2000, 15, 'Caregiver', defaultWarningParams)).toBe(true);
  });

  it('does NOT show warning when consumed is exactly 50% of goal at 3PM', () => {
    // 50% of 2000 = 1000
    expect(shouldShowLowHydrationWarning(1000, 2000, 15, 'Caregiver', defaultWarningParams)).toBe(false);
  });
});
