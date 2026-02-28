import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidDosage,
  classifyEntityConfidence,
  resolveEntityStatus,
  shouldSetOcrFailed,
  isValidNotification,
} from '../lib/medical-entity-validation';

// Feature: mimamori-reliability-audit, Property 10: Medical entity dosage validation
// Feature: mimamori-reliability-audit, Property 11: Medical entity confidence and status assignment
// Feature: mimamori-reliability-audit, Property 20: OCR failure flag propagation
// Feature: mimamori-reliability-audit, Property 21: In-app notification shape completeness

/**
 * Property 10: Medical entity dosage validation
 *
 * For any dosage string, the dosage validator should accept it if and only if
 * it contains at least one numeric component and at least one recognized unit
 * pattern (mg, ml, mcg, units, IU). Dosage strings without numeric components
 * or without recognized units should be flagged as invalid.
 *
 * **Validates: Requirements 14.1, 17.1**
 */

const RECOGNIZED_UNITS = ['mg', 'ml', 'mcg', 'units', 'IU'] as const;

/** Arbitrary that generates a valid dosage string: number + space + recognized unit. */
const validDosageArb = fc
  .tuple(
    fc.integer({ min: 1, max: 9999 }),
    fc.constantFrom(...RECOGNIZED_UNITS),
  )
  .map(([num, unit]) => `${num} ${unit}`);

/** Arbitrary that generates a string with NO numeric component (only letters). */
const noNumericArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(''));

/** Arbitrary that generates a string with a number but NO recognized unit. */
const numericNoUnitArb = fc
  .tuple(
    fc.integer({ min: 1, max: 9999 }),
    fc.constantFrom('tablets', 'caps', 'oz', 'lb', 'kg', 'g', 'cc', 'drops', 'puffs', 'patches'),
  )
  .map(([num, suffix]) => `${num} ${suffix}`);

describe('Property 10: Medical entity dosage validation', () => {
  it('accepts dosage strings with a numeric component and a recognized unit', () => {
    fc.assert(
      fc.property(validDosageArb, (dosage) => {
        expect(isValidDosage(dosage)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects dosage strings without any numeric component', () => {
    fc.assert(
      fc.property(noNumericArb, (dosage) => {
        expect(isValidDosage(dosage)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects dosage strings with a number but no recognized unit', () => {
    fc.assert(
      fc.property(numericNoUnitArb, (dosage) => {
        expect(isValidDosage(dosage)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('is case-insensitive for unit matching', () => {
    const caseVariantArb = fc
      .tuple(
        fc.integer({ min: 1, max: 9999 }),
        fc.constantFrom('MG', 'Mg', 'mG', 'ML', 'Ml', 'MCG', 'Mcg', 'UNITS', 'Units', 'iu', 'Iu'),
      )
      .map(([num, unit]) => `${num} ${unit}`);

    fc.assert(
      fc.property(caseVariantArb, (dosage) => {
        expect(isValidDosage(dosage)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});

/**
 * Property 11: Medical entity confidence and status assignment
 *
 * For any medical entity returned by Comprehend Medical, if the entity's
 * confidence score is below 0.5 it should be flagged as "Unverified", and
 * if the entity has no explicit status from Comprehend Medical it should be
 * labeled "Status not determined" (never defaulting to "Normal").
 *
 * **Validates: Requirements 17.1, 17.2, 17.3**
 */

/** Arbitrary for confidence scores below 0.5 (unverified). */
const lowConfidenceArb = fc.double({ min: 0, max: 0.4999, noNaN: true });

/** Arbitrary for confidence scores at or above 0.5 (verified). */
const highConfidenceArb = fc.double({ min: 0.5, max: 1.0, noNaN: true });

describe('Property 11: Medical entity confidence and status assignment', () => {
  it('flags entities with confidence < 0.5 as Unverified', () => {
    fc.assert(
      fc.property(lowConfidenceArb, (confidence) => {
        const result = classifyEntityConfidence(confidence);
        expect(result.verified).toBe(false);
        expect(result.status).toBe('Unverified');
      }),
      { numRuns: 20 },
    );
  });

  it('marks entities with confidence >= 0.5 as verified', () => {
    fc.assert(
      fc.property(highConfidenceArb, (confidence) => {
        const result = classifyEntityConfidence(confidence);
        expect(result.verified).toBe(true);
        expect(result.status).toBeNull();
      }),
      { numRuns: 20 },
    );
  });

  it('assigns "Unverified" status for low-confidence entities regardless of explicit status', () => {
    const statusArb = fc.constantFrom('High', 'Low', 'Attention', 'Normal', undefined, null);

    fc.assert(
      fc.property(fc.tuple(lowConfidenceArb, statusArb), ([confidence, explicitStatus]) => {
        const status = resolveEntityStatus(explicitStatus, confidence);
        expect(status).toBe('Unverified');
      }),
      { numRuns: 20 },
    );
  });

  it('never defaults to "Normal" for entities without explicit status', () => {
    const noStatusArb = fc.constantFrom(undefined, null, 'Normal');

    fc.assert(
      fc.property(fc.tuple(highConfidenceArb, noStatusArb), ([confidence, explicitStatus]) => {
        const status = resolveEntityStatus(explicitStatus, confidence);
        expect(status).not.toBe('Normal');
        expect(status).toBe('Status not determined');
      }),
      { numRuns: 20 },
    );
  });

  it('preserves explicit non-Normal status for high-confidence entities', () => {
    const explicitStatusArb = fc.constantFrom('High', 'Low', 'Attention');

    fc.assert(
      fc.property(
        fc.tuple(highConfidenceArb, explicitStatusArb),
        ([confidence, explicitStatus]) => {
          const status = resolveEntityStatus(explicitStatus, confidence);
          expect(status).toBe(explicitStatus);
        },
      ),
      { numRuns: 20 },
    );
  });
});

/**
 * Property 20: OCR failure flag propagation
 *
 * For any file analysis where Textract returns empty text or throws an error,
 * the API response should include ocrFailed: true. When Textract succeeds with
 * non-empty text, the response should not include ocrFailed: true.
 *
 * **Validates: Requirements 14.1**
 */

describe('Property 20: OCR failure flag propagation', () => {
  it('sets ocrFailed=true when Textract throws an error', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const result = shouldSetOcrFailed({ success: false, text });
        expect(result).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('sets ocrFailed=true when Textract returns empty text', () => {
    const emptyTextArb = fc.constantFrom('', '   ', '\n', '\t', '  \n  ');

    fc.assert(
      fc.property(emptyTextArb, (text) => {
        const result = shouldSetOcrFailed({ success: true, text });
        expect(result).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('sets ocrFailed=false when Textract succeeds with non-empty text', () => {
    const nonEmptyTextArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(nonEmptyTextArb, (text) => {
        const result = shouldSetOcrFailed({ success: true, text });
        expect(result).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});

/**
 * Property 21: In-app notification shape completeness
 *
 * For any in-app notification stored in DynamoDB for a document analysis alert,
 * the notification item should contain non-empty title, message, createdAt
 * (ISO timestamp), and sourceDocId fields.
 *
 * **Validates: Requirements 30.2**
 */

/** Arbitrary that generates a valid notification object. */
const validNotificationArb = fc
  .tuple(
    fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
    fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() }),
    fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  )
  .map(([title, message, timestamp, sourceDocId]) => ({
    title,
    message,
    createdAt: new Date(timestamp).toISOString(),
    sourceDocId,
  }));

describe('Property 21: In-app notification shape completeness', () => {
  it('accepts notifications with all required non-empty fields and valid ISO timestamp', () => {
    fc.assert(
      fc.property(validNotificationArb, (notification) => {
        expect(isValidNotification(notification)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects notifications with empty title', () => {
    const arb = validNotificationArb.map((n) => ({ ...n, title: '' }));

    fc.assert(
      fc.property(arb, (notification) => {
        expect(isValidNotification(notification)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects notifications with empty message', () => {
    const arb = validNotificationArb.map((n) => ({ ...n, message: '' }));

    fc.assert(
      fc.property(arb, (notification) => {
        expect(isValidNotification(notification)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects notifications with empty sourceDocId', () => {
    const arb = validNotificationArb.map((n) => ({ ...n, sourceDocId: '' }));

    fc.assert(
      fc.property(arb, (notification) => {
        expect(isValidNotification(notification)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects notifications with invalid createdAt timestamp', () => {
    const invalidTimestampArb = fc.constantFrom('not-a-date', '', '2024-13-45', 'abc123');
    const arb = fc
      .tuple(validNotificationArb, invalidTimestampArb)
      .map(([n, badDate]) => ({ ...n, createdAt: badDate }));

    fc.assert(
      fc.property(arb, (notification) => {
        expect(isValidNotification(notification)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects notifications with missing required fields', () => {
    const missingFieldArb = fc.constantFrom('title', 'message', 'createdAt', 'sourceDocId');
    const arb = fc
      .tuple(validNotificationArb, missingFieldArb)
      .map(([n, field]) => {
        const copy = { ...n } as Record<string, unknown>;
        delete copy[field];
        return copy;
      });

    fc.assert(
      fc.property(arb, (notification) => {
        expect(isValidNotification(notification)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
