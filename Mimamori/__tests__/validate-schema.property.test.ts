import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateProbeResponse,
  validateFileAnalysisResponse,
  validateVisitPrepResponse,
} from '../lib/ai/validate-schema';

// Feature: mimamori-reliability-audit, Property 8: Probe response JSON validation
// Feature: mimamori-reliability-audit, Property 9: File analysis response validation
// Feature: mimamori-reliability-audit, Property 23: Visit-prep response validation

/**
 * Property 8: Probe response JSON validation
 *
 * For any JSON value, validateProbeResponse should return { valid: true }
 * if and only if the value is an array of exactly 5 objects each containing
 * non-empty question (string) and title (string) fields. All other inputs
 * should return { valid: false }.
 *
 * **Validates: Requirements 16.1**
 */

/** Arbitrary that generates a valid probe item (non-empty question + title). */
const validProbeItemArb = fc.record({
  question: fc.string({ minLength: 1 }),
  title: fc.string({ minLength: 1 }),
});

/** Arbitrary that generates a valid probe response: exactly 5 valid items. */
const validProbeResponseArb = fc.tuple(
  validProbeItemArb,
  validProbeItemArb,
  validProbeItemArb,
  validProbeItemArb,
  validProbeItemArb,
).map((items) => items);

describe('Property 8: Probe response JSON validation', () => {
  it('accepts valid arrays of exactly 5 probe items with non-empty question and title', () => {
    fc.assert(
      fc.property(validProbeResponseArb, (input) => {
        const result = validateProbeResponse(input);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects arrays with fewer than 5 items', () => {
    const arb = fc.integer({ min: 0, max: 4 }).chain((count) =>
      fc.array(validProbeItemArb, { minLength: count, maxLength: count }),
    );

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateProbeResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects arrays with more than 5 items', () => {
    const arb = fc.integer({ min: 6, max: 15 }).chain((count) =>
      fc.array(validProbeItemArb, { minLength: count, maxLength: count }),
    );

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateProbeResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects items with empty question or title', () => {
    const itemWithEmptyFieldArb = fc.oneof(
      fc.record({ question: fc.constant(''), title: fc.string({ minLength: 1 }) }),
      fc.record({ question: fc.string({ minLength: 1 }), title: fc.constant('') }),
      fc.record({ question: fc.constant(''), title: fc.constant('') }),
    );

    // Build an array of 5 where at least one item has an empty field
    const arb = fc
      .tuple(
        fc.integer({ min: 0, max: 4 }),
        itemWithEmptyFieldArb,
      )
      .chain(([badIndex, badItem]) =>
        fc.tuple(
          ...Array.from({ length: 5 }, (_, i) =>
            i === badIndex ? fc.constant(badItem) : validProbeItemArb,
          ),
        ),
      );

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateProbeResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-array inputs', () => {
    const nonArrayArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.record({ question: fc.string(), title: fc.string() }),
    );

    fc.assert(
      fc.property(nonArrayArb, (input) => {
        const result = validateProbeResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});


/**
 * Property 9: File analysis response validation
 *
 * For any JSON value, validateFileAnalysisResponse should return { valid: true }
 * if and only if the value is an object containing non-empty summary (string)
 * and actualType (string) fields. All other inputs should return { valid: false }.
 *
 * **Validates: Requirements 16.4**
 */

/** Arbitrary that generates a valid file analysis object. */
const validFileAnalysisArb = fc.record({
  summary: fc.string({ minLength: 1 }),
  actualType: fc.string({ minLength: 1 }),
});

describe('Property 9: File analysis response validation', () => {
  it('accepts objects with non-empty summary and actualType strings', () => {
    fc.assert(
      fc.property(validFileAnalysisArb, (input) => {
        const result = validateFileAnalysisResponse(input);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects objects with empty summary', () => {
    const arb = fc.record({
      summary: fc.constant(''),
      actualType: fc.string({ minLength: 1 }),
    });

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateFileAnalysisResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects objects with empty actualType', () => {
    const arb = fc.record({
      summary: fc.string({ minLength: 1 }),
      actualType: fc.constant(''),
    });

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateFileAnalysisResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects objects missing required fields', () => {
    const arb = fc.oneof(
      fc.record({ summary: fc.string({ minLength: 1 }) }),
      fc.record({ actualType: fc.string({ minLength: 1 }) }),
      fc.constant({}),
    );

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateFileAnalysisResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-object inputs', () => {
    const nonObjectArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.constant(undefined),
      fc.array(fc.string()),
    );

    fc.assert(
      fc.property(nonObjectArb, (input) => {
        const result = validateFileAnalysisResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});

/**
 * Property 23: Visit-prep response validation
 *
 * For any string value, validateVisitPrepResponse should return { valid: true }
 * if and only if the value is a non-empty string. Empty strings, null, undefined,
 * and non-string values should return { valid: false }.
 *
 * **Validates: Requirements 16.3**
 */

describe('Property 23: Visit-prep response validation', () => {
  it('accepts non-empty strings', () => {
    const arb = fc.string({ minLength: 1 });

    fc.assert(
      fc.property(arb, (input) => {
        const result = validateVisitPrepResponse(input);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data).toBe(input);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('rejects empty strings', () => {
    const result = validateVisitPrepResponse('');
    expect(result.valid).toBe(false);
  });

  it('rejects null and undefined', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (input) => {
          const result = validateVisitPrepResponse(input);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('rejects non-string values', () => {
    const nonStringArb = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.array(fc.string()),
      fc.record({ key: fc.string() }),
      fc.double(),
    );

    fc.assert(
      fc.property(nonStringArb, (input) => {
        const result = validateVisitPrepResponse(input);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
