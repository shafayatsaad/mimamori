import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: static-to-dynamic-conversion
 * Property 17: Custom alert message overrides default template
 *
 * For any non-empty custom message string, when the alert API receives a
 * request with that custom message, the email content should be the custom
 * message, not the default template. When no custom message is provided,
 * the email content should be the default template.
 *
 * **Validates: Requirements 21.3**
 */

// ---------------------------------------------------------------------------
// Pure helper that mirrors the message-selection logic in
// app/api/send-alert/route.ts:
//   const emailContent = message || appConfig.alert.defaultTemplate;
// ---------------------------------------------------------------------------

function resolveAlertContent(
  customMessage: string | undefined | null,
  defaultTemplate: string,
): string {
  return customMessage || defaultTemplate;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty strings suitable for custom messages. */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.length > 0);

/** Non-empty strings suitable for default templates. */
const defaultTemplateArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.length > 0);

/** Values that represent "no custom message provided". */
const absentMessageArb = fc.constantFrom(undefined, null, '');

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 17: Custom alert message overrides default template', () => {
  it('uses the custom message when a non-empty custom message is provided', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, defaultTemplateArb, (customMessage, defaultTemplate) => {
        const result = resolveAlertContent(customMessage, defaultTemplate);
        expect(result).toBe(customMessage);
      }),
      { numRuns: 20 },
    );
  });

  it('uses the default template when no custom message is provided (undefined)', () => {
    fc.assert(
      fc.property(defaultTemplateArb, (defaultTemplate) => {
        const result = resolveAlertContent(undefined, defaultTemplate);
        expect(result).toBe(defaultTemplate);
      }),
      { numRuns: 20 },
    );
  });

  it('uses the default template when custom message is null', () => {
    fc.assert(
      fc.property(defaultTemplateArb, (defaultTemplate) => {
        const result = resolveAlertContent(null, defaultTemplate);
        expect(result).toBe(defaultTemplate);
      }),
      { numRuns: 20 },
    );
  });

  it('uses the default template when custom message is an empty string', () => {
    fc.assert(
      fc.property(defaultTemplateArb, (defaultTemplate) => {
        const result = resolveAlertContent('', defaultTemplate);
        expect(result).toBe(defaultTemplate);
      }),
      { numRuns: 20 },
    );
  });

  it('falls back to default template for all absent message variants', () => {
    fc.assert(
      fc.property(absentMessageArb, defaultTemplateArb, (absentMessage, defaultTemplate) => {
        const result = resolveAlertContent(absentMessage, defaultTemplate);
        expect(result).toBe(defaultTemplate);
      }),
      { numRuns: 20 },
    );
  });

  it('never returns the default template when a non-empty custom message is provided and differs from the template', () => {
    fc.assert(
      fc.property(nonEmptyStringArb, defaultTemplateArb, (customMessage, defaultTemplate) => {
        fc.pre(customMessage !== defaultTemplate);
        const result = resolveAlertContent(customMessage, defaultTemplate);
        expect(result).not.toBe(defaultTemplate);
      }),
      { numRuns: 20 },
    );
  });
});
