/**
 * Centralized configuration service for the Mimamori application.
 *
 * Reads all configurable values from environment variables with typed defaults.
 * Required AWS keys throw if the corresponding env var is unset.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AwsConfig {
  region: string;
  s3BucketName: string;
  sesFromEmail: string;
  bedrockRouterArn: string;
  usersTable: string;
  dataTable: string;
}

export interface SessionConfig {
  jwtSecret: string;
  expirySeconds: number;
}

export interface HydrationConfig {
  hotTemp: number;
  warmTemp: number;
  hotGoalMl: number;
  warmGoalMl: number;
  coldGoalMl: number;
  intakeMinMl: number;
  intakeMaxMl: number;
  lowHydrationHour: number;
  lowHydrationPercent: number;
  presetsMl: number[];
}

export interface WeatherConfig {
  apiUrl: string;
  cacheTtlMs: number;
  timeoutMs: number;
  defaultTemp: number;
}

export interface AiConfig {
  modelMicro: string;
  modelOrchestrator: string;
  modelAnalyzer: string;
  modelProcessor: string;
  modelSpecialist: string;
}

export interface DemoConfig {
  enabled: boolean;
  joinCode: string;
}

export interface LocalStorageConfig {
  prefix: string;
}

export interface AlertConfig {
  defaultSubject: string;
  defaultTemplate: string;
}

export interface CspConfig {
  directives: string;
}

export interface AppConfig {
  aws: AwsConfig;
  session: SessionConfig;
  hydration: HydrationConfig;
  weather: WeatherConfig;
  ai: AiConfig;
  demo: DemoConfig;
  localStorage: LocalStorageConfig;
  alert: AlertConfig;
  csp: CspConfig;
}

// ---------------------------------------------------------------------------
// CarePlan shape (subset used for hydration overrides)
// ---------------------------------------------------------------------------

export interface CarePlanOverrides {
  hydrationHotTemp?: number | null;
  hydrationWarmTemp?: number | null;
  hydrationHotGoalMl?: number | null;
  hydrationWarmGoalMl?: number | null;
  hydrationColdGoalMl?: number | null;
  intakeMinMl?: number | null;
  intakeMaxMl?: number | null;
  lowHydrationHour?: number | null;
  lowHydrationPercent?: number | null;
  hydrationPresetsMl?: string | null; // comma-separated, e.g. "100,250,500"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string, inlinedValue?: string | undefined): string {
  // Prefer the inlined value (resolved at build time by Next.js) over dynamic lookup.
  // Next.js only inlines direct process.env.VAR references, not process.env[name].
  const value = inlinedValue ?? process.env[name];
  if (value === undefined || value === '') {
    // On the client side, server-only env vars (e.g. AWS keys) are not available.
    // Return empty string instead of throwing — these values are only used server-side.
    if (typeof window !== 'undefined') return '';
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Set it in your environment or .env.local (excluded from version control).',
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : fallback;
}

function optionalEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function optionalEnvFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function optionalEnvBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

function parsePresetsMl(raw: string | undefined, fallback: number[]): number[] {
  if (raw === undefined || raw === '') return fallback;
  try {
    return raw.split(',').map((s) => {
      const n = parseInt(s.trim(), 10);
      if (Number.isNaN(n)) throw new Error('NaN');
      return n;
    });
  } catch {
    console.warn(`Invalid HYDRATION_PRESETS_ML value "${raw}", using defaults.`);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Default alert email template (matches current hardcoded value)
// ---------------------------------------------------------------------------

const DEFAULT_ALERT_TEMPLATE = `🏥 MIMAMORI HEALTH ALERT

📋 Status: Routine Check-In Required
👤 Patient: Your loved one

⚠️ Flagged Symptoms:
• Recent health probes indicate changes in daily patterns
• AI analysis recommends caregiver review

🔔 Action Required:
• Review patient dashboard for detailed metrics
• Confirm medication was taken today

— Mimamori AI Health Platform`;

// ---------------------------------------------------------------------------
// Default CSP directives (matches current next.config.mjs image CSP)
// ---------------------------------------------------------------------------

const DEFAULT_CSP_DIRECTIVES = "default-src 'self'; script-src 'none'; sandbox;";

// ---------------------------------------------------------------------------
// getConfig()
// ---------------------------------------------------------------------------

export function getConfig(): AppConfig {
  return {
    aws: {
      region: optionalEnv('APP_REGION', 'us-west-2'),
      // Direct process.env.X references are inlined by Next.js at build time,
      // ensuring values are available even if the SSR runtime doesn't inject them.
      s3BucketName: requireEnv('APP_S3_BUCKET_NAME', process.env.APP_S3_BUCKET_NAME),
      sesFromEmail: requireEnv('APP_SES_FROM_EMAIL', process.env.APP_SES_FROM_EMAIL),
      bedrockRouterArn: requireEnv('APP_BEDROCK_ROUTER_ARN', process.env.APP_BEDROCK_ROUTER_ARN),
      usersTable: requireEnv('MIMAMORI_USERS_TABLE', process.env.MIMAMORI_USERS_TABLE),
      dataTable: requireEnv('MIMAMORI_DATA_TABLE', process.env.MIMAMORI_DATA_TABLE),
    },
    session: {
      jwtSecret: optionalEnv('SESSION_JWT_SECRET', 'mimamori-dev-secret-change-me'),
      expirySeconds: optionalEnvInt('SESSION_EXPIRY_SECONDS', 86400), // 24 hours
    },
    hydration: {
      hotTemp: optionalEnvFloat('HYDRATION_HOT_TEMP', 28),
      warmTemp: optionalEnvFloat('HYDRATION_WARM_TEMP', 20),
      hotGoalMl: optionalEnvInt('HYDRATION_HOT_GOAL_ML', 2500),
      warmGoalMl: optionalEnvInt('HYDRATION_WARM_GOAL_ML', 2000),
      coldGoalMl: optionalEnvInt('HYDRATION_COLD_GOAL_ML', 1500),
      intakeMinMl: optionalEnvInt('INTAKE_MIN_ML', 50),
      intakeMaxMl: optionalEnvInt('INTAKE_MAX_ML', 2000),
      lowHydrationHour: optionalEnvInt('LOW_HYDRATION_HOUR', 15),
      lowHydrationPercent: optionalEnvInt('LOW_HYDRATION_PERCENT', 50),
      presetsMl: parsePresetsMl(process.env.HYDRATION_PRESETS_ML, [200, 350, 500]),
    },
    weather: {
      apiUrl: optionalEnv('WEATHER_API_URL', 'https://api.open-meteo.com/v1/forecast'),
      cacheTtlMs: optionalEnvInt('WEATHER_CACHE_TTL_MS', 1_800_000),
      timeoutMs: optionalEnvInt('WEATHER_TIMEOUT_MS', 5000),
      defaultTemp: optionalEnvFloat('WEATHER_DEFAULT_TEMP', 20),
    },
    ai: {
      modelMicro: optionalEnv('AI_MODEL_MICRO', 'amazon.nova-micro-v1:0'),
      modelOrchestrator: optionalEnv('AI_MODEL_ORCHESTRATOR', 'anthropic.claude-3-5-haiku-20241022-v1:0'),
      modelAnalyzer: optionalEnv('AI_MODEL_ANALYZER', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
      modelProcessor: optionalEnv('AI_MODEL_PROCESSOR', 'amazon.nova-pro-v1:0'),
      modelSpecialist: optionalEnv('AI_MODEL_SPECIALIST', 'amazon.nova-premier-v1:0'),
    },
    demo: {
      enabled: optionalEnvBool('DEMO_MODE', false),
      joinCode: optionalEnv('DEMO_JOIN_CODE', ''),
    },
    localStorage: {
      prefix: optionalEnv('LOCALSTORAGE_PREFIX', 'mimamori_'),
    },
    alert: {
      defaultSubject: optionalEnv('ALERT_EMAIL_SUBJECT', 'Mimamori Health Alert'),
      defaultTemplate: optionalEnv('ALERT_EMAIL_TEMPLATE', DEFAULT_ALERT_TEMPLATE),
    },
    csp: {
      directives: optionalEnv('CSP_DIRECTIVES', DEFAULT_CSP_DIRECTIVES),
    },
  };
}

// ---------------------------------------------------------------------------
// getHydrationConfig(carePlan?)
// ---------------------------------------------------------------------------

/**
 * Returns a merged HydrationConfig using values from the optional CarePlan
 * overrides, falling back to system-wide defaults from environment / defaults.
 */
export function getHydrationConfig(carePlan?: CarePlanOverrides | null): HydrationConfig {
  const defaults = getConfig().hydration;

  if (!carePlan) return defaults;

  return {
    hotTemp: carePlan.hydrationHotTemp ?? defaults.hotTemp,
    warmTemp: carePlan.hydrationWarmTemp ?? defaults.warmTemp,
    hotGoalMl: carePlan.hydrationHotGoalMl ?? defaults.hotGoalMl,
    warmGoalMl: carePlan.hydrationWarmGoalMl ?? defaults.warmGoalMl,
    coldGoalMl: carePlan.hydrationColdGoalMl ?? defaults.coldGoalMl,
    intakeMinMl: carePlan.intakeMinMl ?? defaults.intakeMinMl,
    intakeMaxMl: carePlan.intakeMaxMl ?? defaults.intakeMaxMl,
    lowHydrationHour: carePlan.lowHydrationHour ?? defaults.lowHydrationHour,
    lowHydrationPercent: carePlan.lowHydrationPercent ?? defaults.lowHydrationPercent,
    presetsMl: carePlan.hydrationPresetsMl
      ? parsePresetsMl(carePlan.hydrationPresetsMl, defaults.presetsMl)
      : defaults.presetsMl,
  };
}
