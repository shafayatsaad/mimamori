import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  detectCriticalBP,
  detectCriticalKeywords,
  checkInactivity,
  type BPClassification,
  type LogEntry,
} from '@/lib/critical-alerts';

// Feature: mimamori-reliability-audit, Property 2: Blood pressure classification correctness

/**
 * Property 2: Blood pressure classification correctness
 *
 * For any blood pressure string in "systolic/diastolic" format with valid numeric
 * values, detectCriticalBP should return 'crisis' when systolic > 180 or
 * diastolic > 120, 'low' when systolic < 90 or diastolic < 60, and 'normal'
 * otherwise. For any invalid or null input, it should return null.
 *
 * **Validates: Requirements 8.1, 8.2, 10.1, 10.2, 10.4**
 */
describe('Feature: mimamori-reliability-audit, Property 2: Blood pressure classification correctness', () => {
  function expectedClassification(systolic: number, diastolic: number): BPClassification {
    if (systolic > 180 || diastolic > 120) return 'crisis';
    if (systolic < 90 || diastolic < 60) return 'low';
    return 'normal';
  }

  it('classifies valid BP strings correctly for any systolic/diastolic pair', () => {
    const bpArb = fc.tuple(
      fc.integer({ min: 1, max: 300 }),
      fc.integer({ min: 1, max: 250 }),
    );

    fc.assert(
      fc.property(bpArb, ([systolic, diastolic]) => {
        const result = detectCriticalBP(`${systolic}/${diastolic}`);
        expect(result).toBe(expectedClassification(systolic, diastolic));
      }),
      { numRuns: 20 },
    );
  });

  it('returns crisis when systolic > 180 regardless of diastolic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 181, max: 300 }),
        fc.integer({ min: 1, max: 250 }),
        (systolic, diastolic) => {
          const result = detectCriticalBP(`${systolic}/${diastolic}`);
          expect(result).toBe('crisis');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns crisis when diastolic > 120 regardless of systolic', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 121, max: 250 }),
        (systolic, diastolic) => {
          const result = detectCriticalBP(`${systolic}/${diastolic}`);
          expect(result).toBe('crisis');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns low when systolic < 90 and not crisis', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 89 }),
        fc.integer({ min: 1, max: 120 }),
        (systolic, diastolic) => {
          const result = detectCriticalBP(`${systolic}/${diastolic}`);
          expect(result).toBe('low');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns low when diastolic < 60 and not crisis', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 90, max: 180 }),
        fc.integer({ min: 1, max: 59 }),
        (systolic, diastolic) => {
          const result = detectCriticalBP(`${systolic}/${diastolic}`);
          expect(result).toBe('low');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns normal for values in normal range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 90, max: 180 }),
        fc.integer({ min: 60, max: 120 }),
        (systolic, diastolic) => {
          const result = detectCriticalBP(`${systolic}/${diastolic}`);
          expect(result).toBe('normal');
        },
      ),
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

  it('returns null for strings not in "number/number" format', () => {
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


// Feature: mimamori-reliability-audit, Property 3: Critical keyword detection correctness

/**
 * Property 3: Critical keyword detection correctness
 *
 * For any text string, detectCriticalKeywords should return true if and only if
 * the lowercased text contains at least one of the severity keywords ("critical",
 * "urgent", "emergency", "life-threatening", "immediate attention").
 *
 * **Validates: Requirements 10.1, 10.2, 10.4, 11.1, 11.3**
 */
describe('Feature: mimamori-reliability-audit, Property 3: Critical keyword detection correctness', () => {
  const KEYWORDS = [
    'critical',
    'urgent',
    'emergency',
    'life-threatening',
    'immediate attention',
  ] as const;

  /** Arbitrary that generates text containing at least one keyword (possibly mixed case). */
  const textWithKeywordArb = fc.tuple(
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.constantFrom(...KEYWORDS),
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.boolean(),
  ).map(([prefix, keyword, suffix, upper]) => {
    const kw = upper ? keyword.toUpperCase() : keyword;
    return `${prefix}${kw}${suffix}`;
  });

  /**
   * Arbitrary that generates text guaranteed to NOT contain any keyword.
   * Uses only digits and punctuation that cannot form any keyword substring.
   */
  const safeChars = fc.constantFrom(
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '.', ',', '!', '?', ':', ';', '+', '=', '#',
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

  it('detection is case-insensitive for any mixed-case variant', () => {
    const mixedCaseArb = fc.constantFrom(...KEYWORDS).chain((keyword) =>
      fc.array(fc.boolean(), { minLength: keyword.length, maxLength: keyword.length })
        .map((flags) =>
          keyword
            .split('')
            .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
            .join(''),
        ),
    );

    fc.assert(
      fc.property(mixedCaseArb, (text) => {
        expect(detectCriticalKeywords(text)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('returns false for null, undefined, or empty input', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        (input) => {
          expect(detectCriticalKeywords(input as string | null | undefined)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// Feature: mimamori-reliability-audit, Property 4: Inactivity hours computation

/**
 * Property 4: Inactivity hours computation
 *
 * For any non-empty array of log entries with valid timestamps, checkInactivity
 * should return a non-negative number of hours equal to
 * (Date.now() - mostRecentTimestamp) / 3600000. For an empty array, it should
 * return Infinity.
 *
 * **Validates: Requirements 8.1, 8.2, 11.1, 11.3**
 */
describe('Feature: mimamori-reliability-audit, Property 4: Inactivity hours computation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const FIXED_NOW = new Date('2025-06-15T12:00:00.000Z').getTime();

  /** Generate a log entry with a timestamp in the past relative to FIXED_NOW. */
  const logEntryArb: fc.Arbitrary<LogEntry> = fc.tuple(
    fc.integer({ min: 1, max: 30 * 24 * 60 }), // minutes ago
    fc.boolean(), // use createdAt vs date
  ).map(([minutesAgo, useCreatedAt]) => {
    const ts = new Date(FIXED_NOW - minutesAgo * 60 * 1000).toISOString();
    return useCreatedAt ? { createdAt: ts } : { date: ts };
  });

  it('returns Infinity for an empty log array', () => {
    fc.assert(
      fc.property(fc.constant([]), (logs: LogEntry[]) => {
        expect(checkInactivity(logs)).toBe(Infinity);
      }),
      { numRuns: 20 },
    );
  });

  it('returns hours since the most recent log entry', () => {
    fc.assert(
      fc.property(
        fc.array(logEntryArb, { minLength: 1, maxLength: 10 }),
        (logs) => {
          vi.useFakeTimers();
          vi.setSystemTime(FIXED_NOW);

          const result = checkInactivity(logs);

          // Compute expected: find the most recent timestamp
          const timestamps = logs
            .map((l) => new Date((l.createdAt || l.date)!).getTime())
            .filter(Number.isFinite);
          const mostRecent = Math.max(...timestamps);
          const expectedHours = (FIXED_NOW - mostRecent) / 3600000;

          expect(result).toBeCloseTo(expectedHours, 5);
          expect(result).toBeGreaterThanOrEqual(0);

          vi.useRealTimers();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('always returns a non-negative value', () => {
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

  it('returns Infinity when all entries have invalid timestamps', () => {
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
