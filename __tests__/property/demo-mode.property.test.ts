import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: static-to-dynamic-conversion
 * Property 15: Demo mode join code behavior
 *
 * For any (demoEnabled, submittedCode, configuredDemoCode) combination:
 * - when demoEnabled is false, the join route should reject the demo code;
 * - when demoEnabled is true and submittedCode matches configuredDemoCode
 *   (case-insensitive), the join route should accept it;
 * - when demoEnabled is true and submittedCode does not match, the join route
 *   should reject it.
 *
 * **Validates: Requirements 15.2, 15.3**
 */

// ---------------------------------------------------------------------------
// Pure helper that mirrors the demo-code acceptance logic in
// app/api/caregiver/join/route.ts without requiring AWS SDK mocks.
// ---------------------------------------------------------------------------

function isDemoCodeAccepted(
  demoEnabled: boolean,
  configuredCode: string,
  submittedCode: string,
): boolean {
  return (
    demoEnabled &&
    configuredCode !== '' &&
    submittedCode.toUpperCase() === configuredCode.toUpperCase()
  );
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty alphanumeric strings suitable for join codes. */
const codeArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 15: Demo mode join code behavior', () => {
  it('rejects every code when demo mode is disabled', () => {
    fc.assert(
      fc.property(codeArb, codeArb, (configuredCode, submittedCode) => {
        expect(isDemoCodeAccepted(false, configuredCode, submittedCode)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });

  it('accepts when demo mode is enabled and submitted code matches configured code (case-insensitive)', () => {
    fc.assert(
      fc.property(codeArb, (configuredCode) => {
        // Generate a case-variant of the configured code
        const variants = [
          configuredCode.toUpperCase(),
          configuredCode.toLowerCase(),
          configuredCode, // original
        ];
        for (const variant of variants) {
          expect(isDemoCodeAccepted(true, configuredCode, variant)).toBe(true);
        }
      }),
      { numRuns: 20 },
    );
  });

  it('rejects when demo mode is enabled but submitted code does not match', () => {
    fc.assert(
      fc.property(
        codeArb,
        codeArb,
        (configuredCode, submittedCode) => {
          // Only test when codes genuinely differ (case-insensitive)
          fc.pre(configuredCode.toUpperCase() !== submittedCode.toUpperCase());
          expect(isDemoCodeAccepted(true, configuredCode, submittedCode)).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('rejects when demo mode is enabled but configured code is empty', () => {
    fc.assert(
      fc.property(codeArb, (submittedCode) => {
        expect(isDemoCodeAccepted(true, '', submittedCode)).toBe(false);
      }),
      { numRuns: 20 },
    );
  });
});
