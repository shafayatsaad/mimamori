import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  detectCriticalBP,
  detectCriticalKeywords,
  checkInactivity,
  type LogEntry,
} from '@/lib/critical-alerts';

describe('detectCriticalBP', () => {
  it('returns "crisis" when systolic > 180', () => {
    expect(detectCriticalBP('200/80')).toBe('crisis');
  });

  it('returns "crisis" when diastolic > 120', () => {
    expect(detectCriticalBP('140/130')).toBe('crisis');
  });

  it('returns "crisis" when both are above thresholds', () => {
    expect(detectCriticalBP('200/130')).toBe('crisis');
  });

  it('returns "low" when systolic < 90', () => {
    expect(detectCriticalBP('85/70')).toBe('low');
  });

  it('returns "low" when diastolic < 60', () => {
    expect(detectCriticalBP('100/55')).toBe('low');
  });

  it('returns "low" when both are below thresholds', () => {
    expect(detectCriticalBP('80/50')).toBe('low');
  });

  it('returns "normal" for typical reading', () => {
    expect(detectCriticalBP('120/80')).toBe('normal');
  });

  it('returns "normal" at exact boundary 180/120', () => {
    expect(detectCriticalBP('180/120')).toBe('normal');
  });

  it('returns "normal" at exact boundary 90/60', () => {
    expect(detectCriticalBP('90/60')).toBe('normal');
  });

  it('returns null for null input', () => {
    expect(detectCriticalBP(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(detectCriticalBP(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectCriticalBP('')).toBeNull();
  });

  it('returns null for malformed string without slash', () => {
    expect(detectCriticalBP('12080')).toBeNull();
  });

  it('returns null for non-numeric values', () => {
    expect(detectCriticalBP('abc/def')).toBeNull();
  });

  it('returns null for string with extra parts', () => {
    expect(detectCriticalBP('120/80/60')).toBeNull();
  });

  it('handles whitespace around the string', () => {
    expect(detectCriticalBP('  120/80  ')).toBe('normal');
  });
});

describe('detectCriticalKeywords', () => {
  it('returns true for "critical"', () => {
    expect(detectCriticalKeywords('This is a critical finding')).toBe(true);
  });

  it('returns true for "urgent"', () => {
    expect(detectCriticalKeywords('Urgent care needed')).toBe(true);
  });

  it('returns true for "emergency"', () => {
    expect(detectCriticalKeywords('Emergency situation detected')).toBe(true);
  });

  it('returns true for "life-threatening"', () => {
    expect(detectCriticalKeywords('A life-threatening condition')).toBe(true);
  });

  it('returns true for "immediate attention"', () => {
    expect(detectCriticalKeywords('Requires immediate attention')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(detectCriticalKeywords('CRITICAL ALERT')).toBe(true);
    expect(detectCriticalKeywords('Urgent Notice')).toBe(true);
    expect(detectCriticalKeywords('EMERGENCY')).toBe(true);
  });

  it('returns false for text without keywords', () => {
    expect(detectCriticalKeywords('Everything looks normal')).toBe(false);
  });

  it('returns false for null input', () => {
    expect(detectCriticalKeywords(null)).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(detectCriticalKeywords(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(detectCriticalKeywords('')).toBe(false);
  });
});

describe('checkInactivity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns Infinity for empty list', () => {
    expect(checkInactivity([])).toBe(Infinity);
  });

  it('returns hours since most recent log using createdAt', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const logs: LogEntry[] = [{ createdAt: twoHoursAgo }];
    const hours = checkInactivity(logs);
    expect(hours).toBeCloseTo(2, 0);
  });

  it('returns hours since most recent log using date field', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const logs: LogEntry[] = [{ date: threeHoursAgo }];
    const hours = checkInactivity(logs);
    expect(hours).toBeCloseTo(3, 0);
  });

  it('prefers createdAt over date when both present', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const logs: LogEntry[] = [{ createdAt: oneHourAgo, date: fiveHoursAgo }];
    const hours = checkInactivity(logs);
    expect(hours).toBeCloseTo(1, 0);
  });

  it('picks the most recent log from multiple entries', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    const logs: LogEntry[] = [
      { createdAt: tenHoursAgo },
      { createdAt: oneHourAgo },
    ];
    const hours = checkInactivity(logs);
    expect(hours).toBeCloseTo(1, 0);
  });

  it('returns value >= 0 always', () => {
    // Even if a log is in the future, result should be >= 0
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const logs: LogEntry[] = [{ createdAt: futureDate }];
    expect(checkInactivity(logs)).toBeGreaterThanOrEqual(0);
  });

  it('returns Infinity when all entries have invalid timestamps', () => {
    const logs: LogEntry[] = [
      { createdAt: 'not-a-date' },
      { date: 'also-invalid' },
    ];
    expect(checkInactivity(logs)).toBe(Infinity);
  });

  it('skips entries without timestamp fields', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const logs: LogEntry[] = [
      {} as LogEntry,
      { createdAt: twoHoursAgo },
    ];
    const hours = checkInactivity(logs);
    expect(hours).toBeCloseTo(2, 0);
  });
});
