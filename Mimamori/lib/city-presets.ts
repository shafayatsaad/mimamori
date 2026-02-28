/**
 * Default city presets used for hydration weather lookups.
 * Shared between the API route and AppContext to avoid duplication.
 * Override at runtime via the CITY_PRESETS environment variable (JSON).
 */
export const DEFAULT_CITY_PRESETS: { name: string; lat: number; lon: number }[] = [
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
];
