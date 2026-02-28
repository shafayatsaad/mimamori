import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  detectCriticalBP,
  detectCriticalKeywords,
  checkInactivity,
  type LogEntry,
} from '@/lib/critical-alerts';

// Feature: mimamori-production-readiness, Property 8: Blood pressure classification

/**
 * Property 8: Blood pressure classification
 *
 * *For any* blood pressure string in the format "systolic/diastolic", the
 * `detectCriticalBP` function should return: `'crisis'` when systolic > 180 or
 * diastolic > 120, `'low'` when systolic < 90 or diastolic < 60, and `'normal'`
 * otherwise. *For any* invalid or null BP string, it should return `null`.
 *
 * **Validates: Requirements 13.2, 13.3**
 */
describe('Property 8: Blood pressure classification', () => {
  /** Compute the expected classification from raw numeric values. */
  function expectedClassification(systolic: number, diastolic: number): 'crisis' | 'low' | 'normal' {
    if (systolic > 180 || diastolic > 120) return 'crisis';
    if (systolic < 90 || diastolic < 60) return 'low';
    return 'normal';
  }

  it('classifies valid BP strings correctly for any systolic/diastolic pair', () => {
    const bpArb = fc.tuple(
      fc.integer({ min: 1, max: 300 }),
      fc.integer({ min: 1, max: 200 }),
    );

    fc.assert(
      fc.property(bpArb, ([systolic, diastolic]) => {
        const bpString = `${systolic}/${diastolic}`;
        const result = detectCriticalBP(bpString);
        const expected = expectedClassification(systolic, diastolic);
        expect(result).toBe(expected);
      }),
      { numRuns: 20 },
    );
  });

  it('returns null for null, undefined, or empty input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        (input) => {
          expect(detectCriticalBP(input as string | null | undefined)).toBeNull();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns null for strings that are not in "number/number" format', () => {
    const invalidArb = fc.oneof(
      // No slash
      fc.array(fc.constantFrom('a', 'b', '1', '2', ' '), { minLength: 1, maxLength: 10 })
        .map((chars) => chars.join(''))
        .filter((s) => !s.includes('/')),
      // Too many slashes
      fc.tuple(fc.integer(), fc.integer(), fc.integer())
        .map(([a, b, c]) => `${a}/${b}/${c}`),
      // Non-numeric parts
      fc.tuple(
        fc.array(fc.constantFrom('a', 'b', 'c'), { minLength: 1, maxLength: 4 }).map((c) => c.join('')),
        fc.array(fc.constantFrom('x', 'y', 'z'), { minLength: 1, maxLength: 4 }).map((c) => c.join('')),
      ).map(([a, b]) => `${a}/${b}`),
    );

    fc.assert(
      fc.property(invalidArb, (input) => {
        expect(detectCriticalBP(input)).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});

// Feature: mimamori-production-readiness, Property 9: Severity keyword detection

/**
 * Property 9: Severity keyword detection
 *
 * *For any* text string containing at least one of the severity keywords
 * ("critical", "urgent", "emergency", "life-threatening", "immediate attention"),
 * `detectCriticalKeywords` should return true. *For any* text string containing
 * none of these keywords, it should return false.
 *
 * **Validates: Requirements 13.4**
 */
describe('Property 9: Severity keyword detection', () => {
  const KEYWORDS = [
    'critical',
    'urgent',
    'emergency',
    'life-threatening',
    'immediate attention',
  ] as const;

  /** Arbitrary that generates text containing at least one keyword. */
  const textWithKeywordArb = fc.tuple(
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.constantFrom(...KEYWORDS),
    fc.string({ minLength: 0, maxLength: 20 }),
  ).map(([prefix, keyword, suffix]) => `${prefix}${keyword}${suffix}`);

  /**
   * Arbitrary that generates safe text guaranteed to NOT contain any keyword.
   * Uses only digits and punctuation characters that cannot form any keyword.
   */
  const safeChars = fc.constantFrom(
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '.', ',', '!', '?', ':', ';', '-', '+', '=', '#',
    '@', '$', '%', '^', '&', '*', '(', ')', '[', ']',
  );
  const textWithoutKeywordArb = fc.array(safeChars, { minLength: 1, maxLength: 30 })
    .map((chars) => chars.join(''));

  it('returns true when text contains at least one severity keyword', () => {
    fc.assert(
      fc.property(textWithKeywordArb, (text) => {
        expect(detectCriticalKeywords(text)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('returns false when text contains no severity keywords', () => {
    fc.assert(
      fc.property(textWithoutKeywordArb, (text) => {
        expect(detectCriticalKeywords(text)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('detection is case-insensitive', () => {
    const mixedCaseKeywordArb = fc.constantFrom(...KEYWORDS).chain((keyword) =>
      fc.array(fc.boolean(), { minLength: keyword.length, maxLength: keyword.length })
        .map((flags) =>
          keyword
            .split('')
            .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
            .join(''),
        ),
    );

    fc.assert(
      fc.property(mixedCaseKeywordArb, (text) => {
        expect(detectCriticalKeywords(text)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('returns false for null or undefined input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (input) => {
          expect(detectCriticalKeywords(input as string | null | undefined)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// Feature: mimamori-production-readiness, Property 10: Patient inactivity detection

/**
 * Property 10: Patient inactivity detection
 *
 * *For any* list of log entries with timestamps, `checkInactivity` should return
 * the number of hours since the most recent log entry. When the list is empty,
 * it should return `Infinity`. The returned value should always be >= 0.
 *
 * **Validates: Requirements 13.5, 13.6**
 */
describe('Property 10: Patient inactivity detection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Generate a recent ISO timestamp (within the last 30 days). */
  const recentTimestampArb = fc.integer({ min: 1, max: 30 * 24 * 60 }).map((minutesAgo) => {
    const d = new Date(Date.now() - minutesAgo * 60 * 1000);
    return d.toISOString();
  });

  /** Generate a log entry using either createdAt or date field. */
  const logEntryArb: fc.Arbitrary<LogEntry> = fc.tuple(
    recentTimestampArb,
    fc.boolean(),
  ).map(([ts, useCreatedAt]) =>
    useCreatedAt ? { createdAt: ts } : { date: ts },
  );

  it('returns Infinity for an empty log list', () => {
    fc.assert(
      fc.property(fc.constant([]), (logs: LogEntry[]) => {
        expect(checkInactivity(logs)).toBe(Infinity);
      }),
      { numRuns: 20 },
    );
  });

  it('returns hours since the most recent log entry', () => {
    // Use a fixed "now" to avoid timing flakiness
    const fixedNow = new Date('2025-06-01T12:00:00.000Z').getTime();

    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 1, max: 30 * 24 * 60 }).map((minutesAgo) => {
            const d = new Date(fixedNow - minutesAgo * 60 * 1000);
            return { createdAt: d.toISOString() } as LogEntry;
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (logs) => {
          vi.useFakeTimers();
          vi.setSystemTime(fixedNow);

          const result = checkInactivity(logs);

          // Find the most recent timestamp
          const timestamps = logs
            .map((l) => new Date(l.createdAt!).getTime())
            .filter(Number.isFinite);
          const mostRecent = Math.max(...timestamps);
          const expectedHours = (fixedNow - mostRecent) / (1000 * 60 * 60);

          expect(result).toBeCloseTo(expectedHours, 5);

          vi.useRealTimers();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('always returns a value >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(logEntryArb, { minLength: 0, maxLength: 10 }),
        (logs) => {
          const result = checkInactivity(logs);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns Infinity when all entries have no valid timestamps', () => {
    const invalidEntryArb: fc.Arbitrary<LogEntry> = fc.oneof(
      fc.constant({} as LogEntry),
      fc.constant({ createdAt: 'not-a-date' } as LogEntry),
      fc.constant({ date: 'invalid' } as LogEntry),
    );

    fc.assert(
      fc.property(
        fc.array(invalidEntryArb, { minLength: 1, maxLength: 5 }),
        (logs) => {
          expect(checkInactivity(logs)).toBe(Infinity);
        },
      ),
      { numRuns: 20 },
    );
  });
});
