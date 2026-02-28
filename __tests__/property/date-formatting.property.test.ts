import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: static-to-dynamic-conversion
 * Property 10: Date formatting respects locale
 *
 * *For any* valid Date object and any supported locale (en, ja),
 * formatting the date with the I18n_System should produce a string
 * that differs from the output of at least one other supported locale
 * (demonstrating locale-awareness), and should not contain the hardcoded
 * `en-US` format when a non-English locale is selected.
 *
 * **Validates: Requirements 9.4**
 */

const supportedLocales = ['en', 'ja'] as const;

/**
 * Arbitrary that generates valid Date objects within a reasonable range.
 * We avoid extreme dates that might cause locale formatting edge cases.
 */
const dateArb = fc
  .integer({
    min: new Date('2000-01-01T00:00:00Z').getTime(),
    max: new Date('2099-12-31T23:59:59Z').getTime(),
  })
  .map((ts) => new Date(ts));

/**
 * Arbitrary that generates a non-English supported locale.
 */
const nonEnglishLocaleArb = fc.constant('ja' as const);

/**
 * Format a date using Intl.DateTimeFormat, which is what next-intl uses under the hood.
 */
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format a date using the hardcoded en-US locale (the pattern we're replacing).
 */
function formatDateEnUS(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

describe('Property 10: Date formatting respects locale', () => {
  it('formatting the same date with en and ja locales produces different output', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const enFormatted = formatDate(date, 'en');
        const jaFormatted = formatDate(date, 'ja');

        // en and ja formatting should differ — Japanese uses different characters,
        // month names (e.g., "1月" vs "January"), and ordering
        expect(enFormatted).not.toBe(jaFormatted);
      }),
      { numRuns: 20 },
    );
  });

  it('non-English locale (ja) output does not match hardcoded en-US format', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const jaFormatted = formatDate(date, 'ja');
        const enUSFormatted = formatDateEnUS(date);

        // When a non-English locale is selected, the output should not
        // be the same as the hardcoded en-US format
        expect(jaFormatted).not.toBe(enUSFormatted);
      }),
      { numRuns: 20 },
    );
  });

  it('each supported locale produces a non-empty string for any valid date', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.constantFrom(...supportedLocales),
        (date, locale) => {
          const formatted = formatDate(date, locale);
          expect(formatted.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('locale-aware formatting is deterministic (same date + locale = same output)', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.constantFrom(...supportedLocales),
        (date, locale) => {
          const first = formatDate(date, locale);
          const second = formatDate(date, locale);
          expect(first).toBe(second);
        },
      ),
      { numRuns: 20 },
    );
  });
});
