import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyDocument, DocumentCategoryRule } from '../../lib/document-categorization';

/**
 * Feature: static-to-dynamic-conversion
 * Property 16: Document categorization by configurable rules
 *
 * For any ordered set of categorization rules (mimePattern, extPattern → documentType)
 * and any file with a MIME type and extension, the classification function should return
 * the documentType of the first matching rule (by priority). When no rule matches, it
 * should return the configured default document type.
 *
 * **Validates: Requirements 16.2**
 */

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Lowercase alpha strings for MIME segments and extensions. */
const alphaArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .map((s) => s.replace(/[^a-z]/gi, 'a').toLowerCase())
  .filter((s) => s.length >= 1);

/** Generate a document type label. */
const docTypeArb = fc.constantFrom(
  'Imaging',
  'Doctor Note',
  'Lab Result',
  'Prescription',
  'Report',
  'Other',
);

/** Generate a single categorization rule. */
const ruleArb: fc.Arbitrary<DocumentCategoryRule> = fc.record({
  mimePattern: alphaArb,
  extPattern: fc.oneof(fc.constant(null), alphaArb),
  documentType: docTypeArb,
  priority: fc.integer({ min: 0, max: 1000 }),
});

/** Generate a non-empty array of rules. */
const rulesArb = fc.array(ruleArb, { minLength: 1, maxLength: 10 });

/** Generate a default type string. */
const defaultTypeArb = fc.constantFrom('Lab Result', 'Unknown', 'Unclassified');

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 16: Document categorization by configurable rules', () => {
  it('returns the documentType of the highest-priority matching rule when MIME matches', () => {
    fc.assert(
      fc.property(rulesArb, defaultTypeArb, (rules, defaultType) => {
        // Pick the highest-priority rule and craft a MIME type that includes its mimePattern
        const sorted = [...rules].sort((a, b) => b.priority - a.priority);
        const topRule = sorted[0];

        // Build a MIME type that contains the rule's mimePattern
        const mimeType = `${topRule.mimePattern}/test`;
        // Use a numeric extension that won't match any alpha-only extPattern
        const extension = '99999';

        const result = classifyDocument(mimeType, extension, rules, defaultType);
        expect(result).toBe(topRule.documentType);
      }),
      { numRuns: 20 },
    );
  });

  it('returns the documentType of the highest-priority matching rule when extension matches', () => {
    fc.assert(
      fc.property(rulesArb, defaultTypeArb, (rules, defaultType) => {
        // Find a rule that has a non-null extPattern
        const sorted = [...rules].sort((a, b) => b.priority - a.priority);
        const ruleWithExt = sorted.find((r) => r.extPattern !== null);
        if (!ruleWithExt) return; // skip if no rule has extPattern

        // Use a MIME type with digits that won't match any alpha-only mimePattern
        const mimeType = '00000/00000';
        const extension = ruleWithExt.extPattern!.split(',')[0].trim();

        const result = classifyDocument(mimeType, extension, rules, defaultType);
        // The result should be the documentType of the highest-priority rule
        // whose mimePattern or extPattern matches
        const expectedRule = sorted.find(
          (r) =>
            mimeType.includes(r.mimePattern) ||
            (r.extPattern !== null &&
              r.extPattern
                .split(',')
                .map((e) => e.trim().toLowerCase())
                .includes(extension.toLowerCase())),
        );
        expect(result).toBe(expectedRule?.documentType);
      }),
      { numRuns: 20 },
    );
  });

  it('returns the configured default type when no rule matches', () => {
    fc.assert(
      fc.property(rulesArb, defaultTypeArb, (rules, defaultType) => {
        // Use digits for MIME and extension — alpha-only patterns can't match
        const mimeType = '00000/00000';
        const extension = '00000';

        const result = classifyDocument(mimeType, extension, rules, defaultType);
        expect(result).toBe(defaultType);
      }),
      { numRuns: 20 },
    );
  });

  it('uses "Lab Result" as default when no defaultType is provided and no rule matches', () => {
    fc.assert(
      fc.property(rulesArb, (rules) => {
        const mimeType = '00000/00000';
        const extension = '00000';

        const result = classifyDocument(mimeType, extension, rules);
        expect(result).toBe('Lab Result');
      }),
      { numRuns: 20 },
    );
  });

  it('respects priority ordering — higher priority rules take precedence', () => {
    fc.assert(
      fc.property(
        alphaArb,
        docTypeArb,
        docTypeArb,
        fc.integer({ min: 0, max: 499 }),
        fc.integer({ min: 500, max: 1000 }),
        defaultTypeArb,
        (pattern, lowDocType, highDocType, lowPri, highPri, defaultType) => {
          fc.pre(lowDocType !== highDocType);

          const rules: DocumentCategoryRule[] = [
            { mimePattern: pattern, extPattern: null, documentType: lowDocType, priority: lowPri },
            { mimePattern: pattern, extPattern: null, documentType: highDocType, priority: highPri },
          ];

          const mimeType = `${pattern}/anything`;
          const result = classifyDocument(mimeType, 'noext', rules, defaultType);

          // Higher priority rule should win
          expect(result).toBe(highDocType);
        },
      ),
      { numRuns: 20 },
    );
  });
});


// Feature: mimamori-production-readiness, Property 5: Document categorization rules

import { DEFAULT_CATEGORY_RULES } from '../../lib/document-categorization';

/**
 * Property 5: Document categorization rules
 *
 * *For any* file with a name containing an insurance keyword ("insurance", "claim",
 * "eob", "coverage") and a PDF or image MIME type, `classifyDocument` should return
 * "Insurance". *For any* file with a DICOM/TIFF MIME type or a name containing an
 * imaging keyword ("xray", "mri", "ct-scan", "ultrasound", "radiology"),
 * `classifyDocument` should return "Imaging".
 *
 * **Validates: Requirements 7.4, 7.5**
 */

// ---------------------------------------------------------------------------
// Arbitraries for Property 5
// ---------------------------------------------------------------------------

const INSURANCE_KEYWORDS = ['insurance', 'claim', 'eob', 'coverage'] as const;
const IMAGING_KEYWORDS = ['xray', 'mri', 'ct-scan', 'ultrasound', 'radiology'] as const;

/** Random prefix/suffix strings for building filenames. */
const filenamePart = fc
  .string({ minLength: 0, maxLength: 8 })
  .map((s) => s.replace(/[^a-zA-Z0-9_-]/g, 'x'));

/** Generates a filename containing one of the given keywords. */
function filenameWithKeyword(keywords: readonly string[]): fc.Arbitrary<string> {
  return fc
    .tuple(filenamePart, fc.constantFrom(...keywords), filenamePart, fc.constantFrom('.pdf', '.png', '.jpg', '.txt'))
    .map(([prefix, keyword, suffix, ext]) => `${prefix}${keyword}${suffix}${ext}`);
}

/** MIME types that are PDF or image — these should trigger Insurance matching. */
const insuranceMimeArb = fc.constantFrom(
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
);

/** A neutral MIME type that won't match any specific rule on its own. */
const neutralMimeArb = fc.constantFrom(
  'application/octet-stream',
  'text/plain',
);

/** A neutral extension that won't match any rule. */
const neutralExtArb = fc.constantFrom('bin', 'dat', 'tmp');

// ---------------------------------------------------------------------------
// Property 5 tests
// ---------------------------------------------------------------------------

describe('Property 5: Document categorization rules', () => {
  it('filenames with insurance keywords classify as "Insurance"', () => {
    fc.assert(
      fc.property(
        filenameWithKeyword(INSURANCE_KEYWORDS),
        neutralMimeArb,
        neutralExtArb,
        (fileName, mimeType, ext) => {
          const result = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Lab Result', fileName);
          expect(result).toBe('Insurance');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('filenames with imaging keywords classify as "Imaging"', () => {
    fc.assert(
      fc.property(
        filenameWithKeyword(IMAGING_KEYWORDS),
        neutralMimeArb,
        neutralExtArb,
        (fileName, mimeType, ext) => {
          const result = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Lab Result', fileName);
          expect(result).toBe('Imaging');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('DICOM MIME type classifies as "Imaging"', () => {
    fc.assert(
      fc.property(
        filenamePart.map((p) => `${p}.bin`),
        neutralExtArb,
        (fileName, ext) => {
          const result = classifyDocument('application/dicom', ext, DEFAULT_CATEGORY_RULES, 'Lab Result', fileName);
          expect(result).toBe('Imaging');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('TIFF MIME type classifies as "Imaging"', () => {
    fc.assert(
      fc.property(
        filenamePart.map((p) => `${p}.bin`),
        neutralExtArb,
        (fileName, ext) => {
          const result = classifyDocument('image/tiff', ext, DEFAULT_CATEGORY_RULES, 'Lab Result', fileName);
          expect(result).toBe('Imaging');
        },
      ),
      { numRuns: 20 },
    );
  });

  it('insurance keywords have higher priority than imaging keywords', () => {
    // A filename containing both an insurance and imaging keyword should classify as Insurance
    // because Insurance priority (105) > Imaging priority (95)
    fc.assert(
      fc.property(
        fc.constantFrom(...INSURANCE_KEYWORDS),
        fc.constantFrom(...IMAGING_KEYWORDS),
        filenamePart,
        neutralMimeArb,
        neutralExtArb,
        (insKeyword, imgKeyword, padding, mimeType, ext) => {
          const fileName = `${padding}${insKeyword}_${imgKeyword}${padding}.pdf`;
          const result = classifyDocument(mimeType, ext, DEFAULT_CATEGORY_RULES, 'Lab Result', fileName);
          expect(result).toBe('Insurance');
        },
      ),
      { numRuns: 20 },
    );
  });
});


// Feature: mimamori-reliability-audit, Property 7: Document confidence threshold classification

import { getDisplayCategory, ClassificationResult } from '../../lib/document-categorization';

/**
 * Property 7: Document confidence threshold classification
 *
 * *For any* document classification result with a confidence score,
 * when confidence < 0.3 the displayed category should be "Uncategorized",
 * when confidence is between 0.3 and 0.7 (exclusive) the category should
 * be shown with a "Low confidence" badge, and when confidence >= 0.7 the
 * category should be shown without a warning badge.
 *
 * **Validates: Requirements 5.2, 5.6**
 */

const categoryArb = fc.constantFrom(
  'Lab Result',
  'Prescription',
  'Doctor Note',
  'Insurance',
  'Imaging',
  'Uncategorized',
);

const classificationResultArb: fc.Arbitrary<ClassificationResult> = fc.record({
  category: categoryArb,
  confidence: fc.double({ min: 0, max: 1, noNaN: true }),
});

describe('Property 7: Document confidence threshold classification', () => {
  it('confidence < 0.3 results in "Uncategorized" with no low-confidence badge', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.double({ min: 0, max: 0.2999999, noNaN: true }),
        (category, confidence) => {
          const result = getDisplayCategory({ category, confidence });
          expect(result.displayCategory).toBe('Uncategorized');
          expect(result.showLowConfidence).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('confidence >= 0.3 and < 0.7 shows original category with low-confidence badge', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.double({ min: 0.3, max: 0.6999999, noNaN: true }),
        (category, confidence) => {
          fc.pre(confidence >= 0.3 && confidence < 0.7);
          const result = getDisplayCategory({ category, confidence });
          expect(result.displayCategory).toBe(category);
          expect(result.showLowConfidence).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('confidence >= 0.7 shows original category with no warning badge', () => {
    fc.assert(
      fc.property(
        categoryArb,
        fc.double({ min: 0.7, max: 1, noNaN: true }),
        (category, confidence) => {
          const result = getDisplayCategory({ category, confidence });
          expect(result.displayCategory).toBe(category);
          expect(result.showLowConfidence).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('the three confidence ranges are exhaustive and mutually exclusive', () => {
    fc.assert(
      fc.property(classificationResultArb, (input) => {
        const result = getDisplayCategory(input);

        if (input.confidence < 0.3) {
          expect(result.displayCategory).toBe('Uncategorized');
          expect(result.showLowConfidence).toBe(false);
        } else if (input.confidence < 0.7) {
          expect(result.displayCategory).toBe(input.category);
          expect(result.showLowConfidence).toBe(true);
        } else {
          expect(result.displayCategory).toBe(input.category);
          expect(result.showLowConfidence).toBe(false);
        }
      }),
      { numRuns: 20 },
    );
  });
});
