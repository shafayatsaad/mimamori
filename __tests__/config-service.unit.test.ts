import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, getHydrationConfig } from '@/lib/config-service';

/**
 * Unit tests for lib/config-service.ts
 *
 * Validates: Requirements 1.6, 4.2, 4.3, 5.2, 6.2, 7.1, 12.1, 12.2,
 *            13.1, 13.2, 13.3, 13.4, 14.1, 15.2, 20.1, 21.1, 21.2
 */

// Snapshot of env so we can restore after each test
let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  envBackup = { ...process.env };
  // Set required AWS keys so getConfig() doesn't throw by default
  process.env.APP_S3_BUCKET_NAME = 'test-bucket';
  process.env.APP_SES_FROM_EMAIL = 'test@example.com';
  process.env.APP_BEDROCK_ROUTER_ARN = 'arn:aws:bedrock:us-west-2:000000000000:test';
  process.env.MIMAMORI_USERS_TABLE = 'TestUsers';
  process.env.MIMAMORI_DATA_TABLE = 'TestData';
});

afterEach(() => {
  process.env = envBackup;
});

// -----------------------------------------------------------------------
// Required AWS keys throw when unset
// -----------------------------------------------------------------------

describe('required AWS keys', () => {
  const requiredKeys: Array<{ envVar: string; label: string }> = [
    { envVar: 'APP_S3_BUCKET_NAME', label: 's3BucketName' },
    { envVar: 'APP_BEDROCK_ROUTER_ARN', label: 'bedrockRouterArn' },
    { envVar: 'APP_SES_FROM_EMAIL', label: 'sesFromEmail' },
    { envVar: 'MIMAMORI_USERS_TABLE', label: 'usersTable' },
    { envVar: 'MIMAMORI_DATA_TABLE', label: 'dataTable' },
  ];

  for (const { envVar, label } of requiredKeys) {
    it(`throws when ${envVar} (${label}) is unset`, () => {
      // Temporarily hide window so requireEnv takes the server-side path
      const origWindow = globalThis.window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
      try {
        delete process.env[envVar];
        expect(() => getConfig()).toThrow(envVar);
      } finally {
        globalThis.window = origWindow;
      }
    });

    it(`throws when ${envVar} (${label}) is empty string`, () => {
      const origWindow = globalThis.window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).window;
      try {
        process.env[envVar] = '';
        expect(() => getConfig()).toThrow(envVar);
      } finally {
        globalThis.window = origWindow;
      }
    });
  }
});

// -----------------------------------------------------------------------
// Optional keys return defaults
// -----------------------------------------------------------------------

describe('optional defaults', () => {
  it('returns correct hydration defaults', () => {
    const cfg = getConfig();
    expect(cfg.hydration).toEqual({
      hotTemp: 28,
      warmTemp: 20,
      hotGoalMl: 2500,
      warmGoalMl: 2000,
      coldGoalMl: 1500,
      intakeMinMl: 50,
      intakeMaxMl: 2000,
      lowHydrationHour: 15,
      lowHydrationPercent: 50,
      presetsMl: [200, 350, 500],
    });
  });

  it('returns correct weather defaults', () => {
    const cfg = getConfig();
    expect(cfg.weather).toEqual({
      apiUrl: 'https://api.open-meteo.com/v1/forecast',
      cacheTtlMs: 1_800_000,
      timeoutMs: 5000,
      defaultTemp: 20,
    });
  });

  it('returns correct AI model defaults', () => {
    const cfg = getConfig();
    expect(cfg.ai).toEqual({
      modelMicro: 'amazon.nova-micro-v1:0',
      modelOrchestrator: 'anthropic.claude-3-5-haiku-20241022-v1:0',
      modelAnalyzer: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      modelProcessor: 'amazon.nova-pro-v1:0',
      modelSpecialist: 'amazon.nova-premier-v1:0',
    });
  });

  it('returns correct demo defaults', () => {
    const cfg = getConfig();
    expect(cfg.demo).toEqual({ enabled: false, joinCode: '' });
  });

  it('returns correct localStorage default prefix', () => {
    const cfg = getConfig();
    expect(cfg.localStorage.prefix).toBe('mimamori_');
  });

  it('returns correct alert defaults', () => {
    const cfg = getConfig();
    expect(cfg.alert.defaultSubject).toBe('Mimamori Health Alert');
    expect(cfg.alert.defaultTemplate).toContain('MIMAMORI HEALTH ALERT');
  });

  it('returns correct CSP default', () => {
    const cfg = getConfig();
    expect(cfg.csp.directives).toBe("default-src 'self'; script-src 'none'; sandbox;");
  });

  it('returns correct session defaults', () => {
    const cfg = getConfig();
    expect(cfg.session.expirySeconds).toBe(86400);
  });

  it('returns correct AWS region default', () => {
    const cfg = getConfig();
    expect(cfg.aws.region).toBe('us-west-2');
  });
});

// -----------------------------------------------------------------------
// Env overrides
// -----------------------------------------------------------------------

describe('env overrides', () => {
  it('reads weather config from env', () => {
    process.env.WEATHER_CACHE_TTL_MS = '60000';
    process.env.WEATHER_TIMEOUT_MS = '3000';
    process.env.WEATHER_API_URL = 'https://custom.api/forecast';
    process.env.WEATHER_DEFAULT_TEMP = '25';

    const cfg = getConfig();
    expect(cfg.weather).toEqual({
      apiUrl: 'https://custom.api/forecast',
      cacheTtlMs: 60000,
      timeoutMs: 3000,
      defaultTemp: 25,
    });
  });

  it('reads hydration presets from env', () => {
    process.env.HYDRATION_PRESETS_ML = '100,250,500,750';
    const cfg = getConfig();
    expect(cfg.hydration.presetsMl).toEqual([100, 250, 500, 750]);
  });

  it('falls back to default presets on invalid JSON', () => {
    process.env.HYDRATION_PRESETS_ML = 'not,numbers,here';
    const cfg = getConfig();
    expect(cfg.hydration.presetsMl).toEqual([200, 350, 500]);
  });

  it('reads demo mode from env', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_JOIN_CODE = 'SECRET123';
    const cfg = getConfig();
    expect(cfg.demo).toEqual({ enabled: true, joinCode: 'SECRET123' });
  });

  it('reads localStorage prefix from env', () => {
    process.env.LOCALSTORAGE_PREFIX = 'custom_';
    const cfg = getConfig();
    expect(cfg.localStorage.prefix).toBe('custom_');
  });

  it('falls back to default on NaN for numeric env vars', () => {
    process.env.WEATHER_CACHE_TTL_MS = 'not-a-number';
    const cfg = getConfig();
    expect(cfg.weather.cacheTtlMs).toBe(1_800_000);
  });
});

// -----------------------------------------------------------------------
// getHydrationConfig with CarePlan overrides
// -----------------------------------------------------------------------

describe('getHydrationConfig', () => {
  it('returns system defaults when no carePlan is provided', () => {
    const cfg = getHydrationConfig();
    expect(cfg.hotTemp).toBe(28);
    expect(cfg.warmTemp).toBe(20);
    expect(cfg.hotGoalMl).toBe(2500);
    expect(cfg.warmGoalMl).toBe(2000);
    expect(cfg.coldGoalMl).toBe(1500);
  });

  it('returns system defaults when carePlan is null', () => {
    const cfg = getHydrationConfig(null);
    expect(cfg.hotTemp).toBe(28);
  });

  it('merges carePlan overrides with defaults', () => {
    const cfg = getHydrationConfig({
      hydrationHotTemp: 30,
      hydrationHotGoalMl: 3000,
      intakeMinMl: 100,
    });
    expect(cfg.hotTemp).toBe(30);
    expect(cfg.hotGoalMl).toBe(3000);
    expect(cfg.intakeMinMl).toBe(100);
    // Non-overridden values stay at defaults
    expect(cfg.warmTemp).toBe(20);
    expect(cfg.warmGoalMl).toBe(2000);
    expect(cfg.coldGoalMl).toBe(1500);
    expect(cfg.intakeMaxMl).toBe(2000);
  });

  it('parses hydrationPresetsMl from carePlan', () => {
    const cfg = getHydrationConfig({ hydrationPresetsMl: '100,250,500' });
    expect(cfg.presetsMl).toEqual([100, 250, 500]);
  });

  it('falls back to default presets on invalid carePlan presets', () => {
    const cfg = getHydrationConfig({ hydrationPresetsMl: 'bad,data' });
    expect(cfg.presetsMl).toEqual([200, 350, 500]);
  });
});
