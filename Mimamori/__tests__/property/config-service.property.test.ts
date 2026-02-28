import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getConfig } from '@/lib/config-service';

/**
 * Feature: static-to-dynamic-conversion
 * Property 1: Required AWS config keys have no hardcoded fallbacks
 *
 * For any required AWS configuration key (S3 bucket, Bedrock ARN, SES email,
 * DynamoDB table names), if the corresponding environment variable is not set,
 * the Config_Service should throw an error rather than returning a hardcoded
 * AWS-specific value.
 *
 * Validates: Requirements 1.6
 */

/**
 * Maps each required AWS config key to its environment variable name.
 * These are the five keys that MUST throw when unset.
 */
const REQUIRED_AWS_KEYS: { envVar: string; configPath: string }[] = [
  { envVar: 'APP_S3_BUCKET_NAME', configPath: 'aws.s3BucketName' },
  { envVar: 'APP_BEDROCK_ROUTER_ARN', configPath: 'aws.bedrockRouterArn' },
  { envVar: 'APP_SES_FROM_EMAIL', configPath: 'aws.sesFromEmail' },
  { envVar: 'MIMAMORI_USERS_TABLE', configPath: 'aws.usersTable' },
  { envVar: 'MIMAMORI_DATA_TABLE', configPath: 'aws.dataTable' },
];

describe('Property 1: Required AWS config keys have no hardcoded fallbacks', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save current env values for all required keys
    for (const { envVar } of REQUIRED_AWS_KEYS) {
      savedEnv[envVar] = process.env[envVar];
    }
  });

  afterEach(() => {
    // Restore original env values
    for (const { envVar } of REQUIRED_AWS_KEYS) {
      if (savedEnv[envVar] === undefined) {
        delete process.env[envVar];
      } else {
        process.env[envVar] = savedEnv[envVar];
      }
    }
  });

  it('throws when any single required AWS env var is unset, regardless of which key is chosen', () => {
    // Arbitrary to pick which required key to leave unset
    const keyIndexArb = fc.integer({ min: 0, max: REQUIRED_AWS_KEYS.length - 1 });
    // Random dummy values for the "set" keys
    const dummyValueArb = fc.string({ minLength: 1, maxLength: 100 });

    fc.assert(
      fc.property(keyIndexArb, dummyValueArb, (missingIndex, dummyValue) => {
        // Set all required env vars to a dummy value
        for (const { envVar } of REQUIRED_AWS_KEYS) {
          process.env[envVar] = dummyValue;
        }

        // Unset the one we're testing
        delete process.env[REQUIRED_AWS_KEYS[missingIndex].envVar];

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

  it('throws when all required AWS env vars are unset', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Remove all required env vars
        for (const { envVar } of REQUIRED_AWS_KEYS) {
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

  it('does not throw when all required AWS env vars are set to non-empty values', () => {
    const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(
        fc.tuple(
          nonEmptyStringArb, // APP_S3_BUCKET_NAME
          nonEmptyStringArb, // APP_BEDROCK_ROUTER_ARN
          nonEmptyStringArb, // APP_SES_FROM_EMAIL
          nonEmptyStringArb, // MIMAMORI_USERS_TABLE
          nonEmptyStringArb, // MIMAMORI_DATA_TABLE
        ),
        (values) => {
          for (let i = 0; i < REQUIRED_AWS_KEYS.length; i++) {
            process.env[REQUIRED_AWS_KEYS[i].envVar] = values[i];
          }

          // Should not throw — all required keys are present
          expect(() => getConfig()).not.toThrow();

          // Verify the returned config contains the values we set
          const config = getConfig();
          expect(config.aws.s3BucketName).toBe(values[0]);
          expect(config.aws.bedrockRouterArn).toBe(values[1]);
          expect(config.aws.sesFromEmail).toBe(values[2]);
          expect(config.aws.usersTable).toBe(values[3]);
          expect(config.aws.dataTable).toBe(values[4]);
        },
      ),
      { numRuns: 20 },
    );
  });
});
