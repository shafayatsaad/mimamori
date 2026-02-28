import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateMedicalReasoningRequest,
  validateSendAlertRequest,
  validateAnalyzeFileRequest,
  validateSyncRequest,
} from '../lib/api-validation';

// Feature: mimamori-reliability-audit, Property 12: API request validation rejects missing required fields

/**
 * Property 12: API request validation rejects missing required fields
 *
 * For any API route and any request body missing a required field
 * (e.g., logs for medical-reasoning, email for send-alert, fileUrl for
 * analyze-file, email for sync), the route should return a 400 status code
 * with a JSON body containing an error field describing the missing field.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5**
 */

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a non-empty string (for valid field values). */
const nonEmptyStringArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

/** Generates an array of arbitrary values (for valid logs). */
const validLogsArrayArb = fc.array(fc.anything());

/** Generates values that are NOT arrays (missing / wrong type for logs). */
const notArrayArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.record({ key: fc.string() }),
);

/** Generates values that are NOT non-empty strings (missing / wrong type for email/fileUrl). */
const notNonEmptyStringArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.constant(''),
  fc.constant('   '),
  fc.integer(),
  fc.boolean(),
  fc.array(fc.string()),
);

/** Generates non-object bodies (null, undefined, primitives). */
const nonObjectBodyArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.boolean(),
);

// ---------------------------------------------------------------------------
// /api/medical-reasoning — requires `logs` (array)
// ---------------------------------------------------------------------------

describe('Property 12 — /api/medical-reasoning validation', () => {
  it('accepts bodies with a logs array', () => {
    fc.assert(
      fc.property(validLogsArrayArb, (logs) => {
        const result = validateMedicalReasoningRequest({ logs });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects bodies where logs is missing or not an array', () => {
    fc.assert(
      fc.property(notArrayArb, (badLogs) => {
        const body = badLogs === undefined ? {} : { logs: badLogs };
        const result = validateMedicalReasoningRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain('logs');
        }
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-object bodies', () => {
    fc.assert(
      fc.property(nonObjectBodyArb, (body) => {
        const result = validateMedicalReasoningRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain('logs');
        }
      }),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// /api/send-alert — requires `email` (string)
// ---------------------------------------------------------------------------

describe('Property 12 — /api/send-alert validation', () => {
  it('accepts bodies with a non-empty email string', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (email) => {
        const result = validateSendAlertRequest({ email });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects bodies where email is missing or not a non-empty string', () => {
    fc.assert(
      fc.property(notNonEmptyStringArb, (badEmail) => {
        const body = badEmail === undefined ? {} : { email: badEmail };
        const result = validateSendAlertRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain('email');
        }
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-object bodies', () => {
    fc.assert(
      fc.property(nonObjectBodyArb, (body) => {
        const result = validateSendAlertRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
        }
      }),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// /api/analyze-file — requires `fileUrl` (string)
// ---------------------------------------------------------------------------

describe('Property 12 — /api/analyze-file validation', () => {
  it('accepts bodies with a non-empty fileUrl string', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (fileUrl) => {
        const result = validateAnalyzeFileRequest({ fileUrl });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects bodies where fileUrl is missing or not a non-empty string', () => {
    fc.assert(
      fc.property(notNonEmptyStringArb, (badUrl) => {
        const body = badUrl === undefined ? {} : { fileUrl: badUrl };
        const result = validateAnalyzeFileRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain('fileUrl');
        }
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-object bodies', () => {
    fc.assert(
      fc.property(nonObjectBodyArb, (body) => {
        const result = validateAnalyzeFileRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
        }
      }),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// /api/sync — requires `email` (string)
// ---------------------------------------------------------------------------

describe('Property 12 — /api/sync validation', () => {
  it('accepts bodies with a non-empty email string', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, (email) => {
        const result = validateSyncRequest({ email });
        expect(result.valid).toBe(true);
      }),
      { numRuns: 20 },
    );
  });

  it('rejects bodies where email is missing or not a non-empty string', () => {
    fc.assert(
      fc.property(notNonEmptyStringArb, (badEmail) => {
        const body = badEmail === undefined ? {} : { email: badEmail };
        const result = validateSyncRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
          expect(result.error).toContain('email');
        }
      }),
      { numRuns: 20 },
    );
  });

  it('rejects non-object bodies', () => {
    fc.assert(
      fc.property(nonObjectBodyArb, (body) => {
        const result = validateSyncRequest(body);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.status).toBe(400);
        }
      }),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-route: all validators return 400 + error field for invalid bodies
// ---------------------------------------------------------------------------

describe('Property 12 — All validators return 400 with error field', () => {
  const validators = [
    { name: 'medical-reasoning', fn: validateMedicalReasoningRequest, field: 'logs' },
    { name: 'send-alert', fn: validateSendAlertRequest, field: 'email' },
    { name: 'analyze-file', fn: validateAnalyzeFileRequest, field: 'fileUrl' },
    { name: 'sync', fn: validateSyncRequest, field: 'email' },
  ] as const;

  it('every validator rejects an empty object with status 400 and an error mentioning the field', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...validators),
        (v) => {
          const result = v.fn({});
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.status).toBe(400);
            expect(result.error).toContain(v.field);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
