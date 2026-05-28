import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getConfig } from '@/lib/config-service';

/**
 * Feature: static-to-dynamic-conversion
 * Property 1: Required config keys have no hardcoded fallbacks
 *
 * For any required configuration key (Supabase URL, Supabase Publishable Key,
 * Gemini API Key), if the corresponding environment variable is not set,
 * the Config_Service should throw an error rather than returning a hardcoded
 * value.
 *
 * Validates: Requirements 1.6
 */

/**
 * Maps each required config key to its environment variable name.
 * These are the three keys that MUST throw when unset.
 */
const REQUIRED_KEYS: { envVar: string; configKey: string; subKey: string }[] = [
  { envVar: 'NEXT_PUBLIC_SUPABASE_URL', configKey: 'supabase', subKey: 'url' },
  { envVar: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', configKey: 'supabase', subKey: 'publishableKey' },
  { envVar: 'GEMINI_API_KEY', configKey: 'gemini', subKey: 'apiKey' },
];

describe('Property 1: Required config keys have no hardcoded fallbacks', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save current env values for all required keys
    for (const { envVar } of REQUIRED_KEYS) {
      savedEnv[envVar] = process.env[envVar];
    }
  });

  afterEach(() => {
    // Restore original env values
    for (const { envVar } of REQUIRED_KEYS) {
      if (savedEnv[envVar] === undefined) {
        delete process.env[envVar];
      } else {
        process.env[envVar] = savedEnv[envVar];
      }
    }
  });

  it('throws when any single required env var is unset, regardless of which key is chosen', () => {
    // Arbitrary to pick which required key to leave unset
    const keyIndexArb = fc.integer({ min: 0, max: REQUIRED_KEYS.length - 1 });
    // Random dummy values for the "set" keys
    const dummyValueArb = fc.string({ minLength: 1, maxLength: 100 });

    fc.assert(
      fc.property(keyIndexArb, dummyValueArb, (missingIndex, dummyValue) => {
        // Set all required env vars to a dummy value
        for (const { envVar } of REQUIRED_KEYS) {
          process.env[envVar] = dummyValue;
        }

        // Unset the one we're testing
        delete process.env[REQUIRED_KEYS[missingIndex].envVar];

        // Hide window so requireEnv takes the server-side path (jsdom defines window)
        const origWindow = globalThis.window;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).window;
        try {
          // getConfig() must throw because a required key is missing
          expect(() => getConfig()).toThrow(/Missing required environment variable/);
        } finally {
          globalThis.window = origWindow;
        }
      }),
      { numRuns: 20 },
    );
  });

  it('throws when all required env vars are unset', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Remove all required env vars
        for (const { envVar } of REQUIRED_KEYS) {
          delete process.env[envVar];
        }

        const origWindow = globalThis.window;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).window;
        try {
          expect(() => getConfig()).toThrow(/Missing required environment variable/);
        } finally {
          globalThis.window = origWindow;
        }
      }),
      { numRuns: 20 },
    );
  });

  it('does not throw when all required env vars are set to non-empty values', () => {
    const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(
        fc.tuple(
          nonEmptyStringArb, // NEXT_PUBLIC_SUPABASE_URL
          nonEmptyStringArb, // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          nonEmptyStringArb, // GEMINI_API_KEY
        ),
        (values) => {
          for (let i = 0; i < REQUIRED_KEYS.length; i++) {
            process.env[REQUIRED_KEYS[i].envVar] = values[i];
          }

          // Should not throw — all required keys are present
          expect(() => getConfig()).not.toThrow();

          // Verify the returned config contains the values we set
          const config = getConfig();
          expect((config as any)[REQUIRED_KEYS[0].configKey][REQUIRED_KEYS[0].subKey]).toBe(values[0]);
          expect((config as any)[REQUIRED_KEYS[1].configKey][REQUIRED_KEYS[1].subKey]).toBe(values[1]);
          expect((config as any)[REQUIRED_KEYS[2].configKey][REQUIRED_KEYS[2].subKey]).toBe(values[2]);
        },
      ),
      { numRuns: 20 },
    );
  });
});
