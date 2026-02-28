import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { getConfig } from '@/lib/config-service';

/**
 * Feature: static-to-dynamic-conversion
 * Property 13: Config_Service returns env value or default for weather params
 *
 * For any weather configuration key (cacheTtlMs, timeoutMs, apiUrl, defaultTemp)
 * and any valid value set as the corresponding environment variable, the
 * Config_Service should return that value. When the environment variable is
 * unset, it should return the predefined default (1800000, 5000,
 * "https://api.open-meteo.com/v1/forecast", 20 respectively).
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
 */

/** Required AWS env vars that must be set so getConfig() doesn't throw. */
const REQUIRED_ENV_VARS: Record<string, string> = {
  APP_S3_BUCKET_NAME: 'test-bucket',
  APP_BEDROCK_ROUTER_ARN: 'arn:aws:bedrock:us-west-2:000000000000:router/test',
  APP_SES_FROM_EMAIL: 'test@example.com',
  MIMAMORI_USERS_TABLE: 'TestUsersTable',
  MIMAMORI_DATA_TABLE: 'TestDataTable',
};

/** Weather env var names mapped to their config keys and defaults. */
const WEATHER_PARAMS = {
  WEATHER_CACHE_TTL_MS: { configKey: 'cacheTtlMs' as const, default: 1_800_000 },
  WEATHER_TIMEOUT_MS: { configKey: 'timeoutMs' as const, default: 5000 },
  WEATHER_API_URL: { configKey: 'apiUrl' as const, default: 'https://api.open-meteo.com/v1/forecast' },
  WEATHER_DEFAULT_TEMP: { configKey: 'defaultTemp' as const, default: 20 },
};

const WEATHER_ENV_VARS = Object.keys(WEATHER_PARAMS);

describe('Property 13: Config_Service returns env value or default for weather params', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save current env values for all weather keys + required keys
    for (const key of [...WEATHER_ENV_VARS, ...Object.keys(REQUIRED_ENV_VARS)]) {
      savedEnv[key] = process.env[key];
    }
    // Set required AWS env vars so getConfig() doesn't throw
    for (const [key, value] of Object.entries(REQUIRED_ENV_VARS)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    // Restore original env values
    for (const key of Object.keys(savedEnv)) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('returns the env value for WEATHER_CACHE_TTL_MS when set to a valid positive integer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), (ttl) => {
        // Clear all weather env vars
        for (const key of WEATHER_ENV_VARS) delete process.env[key];
        process.env.WEATHER_CACHE_TTL_MS = String(ttl);

        const config = getConfig();
        expect(config.weather.cacheTtlMs).toBe(ttl);
      }),
      { numRuns: 20 },
    );
  });

  it('returns the env value for WEATHER_TIMEOUT_MS when set to a valid positive integer', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), (timeout) => {
        for (const key of WEATHER_ENV_VARS) delete process.env[key];
        process.env.WEATHER_TIMEOUT_MS = String(timeout);

        const config = getConfig();
        expect(config.weather.timeoutMs).toBe(timeout);
      }),
      { numRuns: 20 },
    );
  });

  it('returns the env value for WEATHER_API_URL when set to a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          for (const key of WEATHER_ENV_VARS) delete process.env[key];
          process.env.WEATHER_API_URL = url;

          const config = getConfig();
          expect(config.weather.apiUrl).toBe(url);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns the env value for WEATHER_DEFAULT_TEMP when set to a valid number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 60 }),
        (temp) => {
          for (const key of WEATHER_ENV_VARS) delete process.env[key];
          process.env.WEATHER_DEFAULT_TEMP = String(temp);

          const config = getConfig();
          expect(config.weather.defaultTemp).toBe(temp);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('returns predefined defaults when no weather env vars are set', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Clear all weather env vars
        for (const key of WEATHER_ENV_VARS) delete process.env[key];

        const config = getConfig();
        expect(config.weather.cacheTtlMs).toBe(1_800_000);
        expect(config.weather.timeoutMs).toBe(5000);
        expect(config.weather.apiUrl).toBe('https://api.open-meteo.com/v1/forecast');
        expect(config.weather.defaultTemp).toBe(20);
      }),
      { numRuns: 20 },
    );
  });

  it('returns default for any weather param whose env var is empty string', () => {
    const envVarArb = fc.constantFrom(...WEATHER_ENV_VARS);

    fc.assert(
      fc.property(envVarArb, (envVar) => {
        // Clear all weather env vars, then set the chosen one to empty
        for (const key of WEATHER_ENV_VARS) delete process.env[key];
        process.env[envVar] = '';

        const config = getConfig();
        const param = WEATHER_PARAMS[envVar as keyof typeof WEATHER_PARAMS];
        expect(config.weather[param.configKey]).toBe(param.default);
      }),
      { numRuns: 20 },
    );
  });
});
