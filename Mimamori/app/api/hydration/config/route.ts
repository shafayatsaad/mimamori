import { NextResponse } from 'next/server';
import { getHydrationConfig } from '@/lib/config-service';
import { prisma } from '@/lib/prisma';
import { DEFAULT_CITY_PRESETS } from '@/lib/city-presets';

/**
 * Returns the hydration configuration (presets, intake bounds, city presets)
 * for a given patient. Merges CarePlan overrides with system defaults.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  let carePlan = null;
  if (email) {
    try {
      carePlan = await prisma.carePlan.findUnique({ where: { patientEmail: email } });
    } catch (_err) {
      // CarePlan lookup failed — fall back to system defaults
    }
  }

  const hydrationConfig = getHydrationConfig(carePlan);

  // Parse city presets from env var CITY_PRESETS (JSON) or use defaults
  let cityPresets: { name: string; lat: number; lon: number }[];
  try {
    const raw = process.env.CITY_PRESETS;
    cityPresets = raw ? JSON.parse(raw) : DEFAULT_CITY_PRESETS;
  } catch {
    cityPresets = DEFAULT_CITY_PRESETS;
  }

  return NextResponse.json({
    presetsMl: hydrationConfig.presetsMl,
    intakeMinMl: hydrationConfig.intakeMinMl,
    intakeMaxMl: hydrationConfig.intakeMaxMl,
    cityPresets,
  });
}
