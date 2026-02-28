import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getModelId, type ModelRole } from '@/lib/ai/model-registry';

/**
 * Feature: static-to-dynamic-conversion
 * Property 8: AI model registry returns env value or default
 *
 * For any model role (micro, orchestrator, analyzer, processor, specialist)
 * and any string value set as the corresponding environment variable,
 * getModelId should return that environment variable value. When the
 * environment variable is unset, it should return the predefined default
 * model ID for that role.
 *
 * **Validates: Requirements 7.1**
 */

/** Required AWS env vars so getConfig() doesn't throw. */
const REQUIRED_ENV_VARS: Record<string, string> = {
  APP_S3_BUCKET_NAME: 'test-bucket',
  APP_BEDROCK_ROUTER_ARN: 'arn:aws:bedrock:us-west-2:000000000000:router/test',
  APP_SES_FROM_EMAIL: 'test@example.com',
  MIMAMORI_USERS_TABLE: 'TestUsersTable',
  MIMAMORI_DATA_TABLE: 'TestDataTable',
};

/** Maps each model role to its env var name and default value. */
const MODEL_ROLES: Record<ModelRole, { envVar: string; default: string }> = {
  micro: { envVar: 'AI_MODEL_MICRO', default: 'amazon.nova-micro-v1:0' },
  orchestrator: { envVar: 'AI_MODEL_ORCHESTRATOR', default: 'anthropic.claude-3-5-haiku-20241022-v1:0' },
  analyzer: { envVar: 'AI_MODEL_ANALYZER', default: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
  processor: { envVar: 'AI_MODEL_PROCESSOR', default: 'amazon.nova-pro-v1:0' },
  specialist: { envVar: 'AI_MODEL_SPECIALIST', default: 'amazon.nova-premier-v1:0' },
};

const ALL_ROLES: ModelRole[] = ['micro', 'orchestrator', 'analyzer', 'processor', 'specialist'];
const AI_ENV_VARS = ALL_ROLES.map((r) => MODEL_ROLES[r].envVar);

describe('Property 8: AI model registry returns env value or default', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [...AI_ENV_VARS, ...Object.keys(REQUIRED_ENV_VARS)]) {
      savedEnv[key] = process.env[key];
    }
    for (const [key, value] of Object.entries(REQUIRED_ENV_VARS)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of Object.keys(savedEnv)) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('returns the env value for any role when the corresponding env var is set', () => {
    const roleArb = fc.constantFrom(...ALL_ROLES);
    const modelIdArb = fc.string({ minLength: 1, maxLength: 200 });

    fc.assert(
      fc.property(roleArb, modelIdArb, (role, modelId) => {
        // Clear all AI env vars
        for (const key of AI_ENV_VARS) delete process.env[key];
        // Set the env var for the chosen role
        process.env[MODEL_ROLES[role].envVar] = modelId;

        expect(getModelId(role)).toBe(modelId);
      }),
      { numRuns: 20 },
    );
  });

  it('returns the predefined default when the env var is unset for any role', () => {
    const roleArb = fc.constantFrom(...ALL_ROLES);

    fc.assert(
      fc.property(roleArb, (role) => {
        // Clear all AI env vars
        for (const key of AI_ENV_VARS) delete process.env[key];

        expect(getModelId(role)).toBe(MODEL_ROLES[role].default);
      }),
      { numRuns: 20 },
    );
  });

  it('returns the default when the env var is set to an empty string', () => {
    const roleArb = fc.constantFrom(...ALL_ROLES);

    fc.assert(
      fc.property(roleArb, (role) => {
        for (const key of AI_ENV_VARS) delete process.env[key];
        process.env[MODEL_ROLES[role].envVar] = '';

        expect(getModelId(role)).toBe(MODEL_ROLES[role].default);
      }),
      { numRuns: 20 },
    );
  });

  it('each role reads only its own env var and does not cross-contaminate', () => {
    const modelIdArb = fc.string({ minLength: 1, maxLength: 100 });

    fc.assert(
      fc.property(
        fc.tuple(modelIdArb, modelIdArb, modelIdArb, modelIdArb, modelIdArb),
        (values) => {
          // Clear all AI env vars, then set each to a unique value
          for (const key of AI_ENV_VARS) delete process.env[key];
          for (let i = 0; i < ALL_ROLES.length; i++) {
            process.env[MODEL_ROLES[ALL_ROLES[i]].envVar] = values[i];
          }

          // Each role should return its own value
          for (let i = 0; i < ALL_ROLES.length; i++) {
            expect(getModelId(ALL_ROLES[i])).toBe(values[i]);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
