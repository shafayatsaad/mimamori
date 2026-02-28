import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitizeForPrompt } from '../lib/ai/input-sanitizer';

// Feature: mimamori-reliability-audit, Property 1: Input sanitizer removes injection patterns

/**
 * Property 1: Input sanitizer removes injection patterns
 *
 * *For any* string containing prompt injection patterns (e.g.,
 * "ignore previous instructions", "you are now", "system:", XML/HTML tags,
 * or excessive whitespace sequences), passing it through sanitizeForPrompt
 * should produce an output that does not contain those patterns, and the
 * output length should be less than or equal to the input length.
 *
 * **Validates: Requirements 19.1**
 */

/** Injection phrases that must be stripped (case-insensitive). */
const INJECTION_PHRASES = [
  'ignore previous instructions',
  'you are now',
  'system:',
];

/** Arbitrary that generates a random injection phrase with random casing. */
const injectionPhraseArb = fc.constantFrom(...INJECTION_PHRASES).chain((phrase) =>
  fc.constant(phrase).map((p) =>
    p
      .split('')
      .map((c) => (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()))
      .join(''),
  ),
);

/** Arbitrary that generates a random HTML/XML tag. */
const htmlTagArb = fc
  .tuple(
    fc.constantFrom('div', 'span', 'script', 'img', 'p', 'br', 'a', 'b', 'i'),
    fc.boolean(), // self-closing?
  )
  .map(([tag, selfClosing]) => (selfClosing ? `<${tag} />` : `<${tag}>content</${tag}>`));

/** Arbitrary that generates excessive newlines (4+). */
const excessiveNewlinesArb = fc
  .integer({ min: 4, max: 20 })
  .map((n) => '\n'.repeat(n));

describe('Property 1: Input sanitizer removes injection patterns', () => {
  it('output never contains injection phrases', () => {
    const arb = fc
      .tuple(fc.string(), injectionPhraseArb, fc.string())
      .map(([before, phrase, after]) => before + phrase + after);

    fc.assert(
      fc.property(arb, (input) => {
        const result = sanitizeForPrompt(input);
        const lower = result.text.toLowerCase();
        for (const phrase of INJECTION_PHRASES) {
          expect(lower).not.toContain(phrase.toLowerCase());
        }
      }),
      { numRuns: 20 },
    );
  });

  it('output never contains XML/HTML tags', () => {
    const arb = fc
      .tuple(fc.string(), htmlTagArb, fc.string())
      .map(([before, tag, after]) => before + tag + after);

    fc.assert(
      fc.property(arb, (input) => {
        const result = sanitizeForPrompt(input);
        expect(result.text).not.toMatch(/<\/?[a-z][a-z0-9]*\b[^>]*\/?>/i);
      }),
      { numRuns: 20 },
    );
  });

  it('output never has more than 3 consecutive newlines', () => {
    const arb = fc
      .tuple(fc.string(), excessiveNewlinesArb, fc.string())
      .map(([before, newlines, after]) => before + newlines + after);

    fc.assert(
      fc.property(arb, (input) => {
        const result = sanitizeForPrompt(input);
        expect(result.text).not.toMatch(/\n{4,}/);
      }),
      { numRuns: 20 },
    );
  });

  it('output length is always <= input length', () => {
    // Use a mix of clean strings and strings with injection patterns
    const cleanArb = fc.string({ minLength: 0, maxLength: 500 });
    const dirtyArb = fc
      .tuple(fc.string(), injectionPhraseArb, htmlTagArb, excessiveNewlinesArb, fc.string())
      .map(([a, phrase, tag, newlines, b]) => a + phrase + tag + newlines + b);

    const arb = fc.oneof(cleanArb, dirtyArb);

    fc.assert(
      fc.property(arb, (input) => {
        const result = sanitizeForPrompt(input);
        expect(result.sanitizedLength).toBeLessThanOrEqual(result.originalLength);
        expect(result.text.length).toBeLessThanOrEqual(input.length);
      }),
      { numRuns: 20 },
    );
  });

  it('wasModified is true when injection patterns were present', () => {
    const arb = fc
      .tuple(
        fc.string(),
        fc.oneof(injectionPhraseArb, htmlTagArb, excessiveNewlinesArb),
        fc.string(),
      )
      .map(([before, pattern, after]) => before + pattern + after);

    fc.assert(
      fc.property(arb, (input) => {
        const result = sanitizeForPrompt(input);
        expect(result.wasModified).toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});
