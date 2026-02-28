import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config-service';

interface WeatherCache {
  temperature: number;
  fetchedAt: number;
}

const cacheMap = new Map<string, WeatherCache>();

export async function GET(request: Request) {
  const config = getConfig();
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Location required. Provide lat and lon query parameters.' },
      { status: 400 },
    );
  }

  const cacheKey = `${lat},${lon}`;

  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < config.weather.cacheTtlMs) {
    return NextResponse.json(
      { temperature: cached.temperature, cached: true },
      { status: 200 },
    );
  }

  try {
    const url = `${config.weather.apiUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`;
    const response = await fetch(url, { signal: AbortSignal.timeout(config.weather.timeoutMs) });

    if (response.status === 429) {
      if (cached) {
        return NextResponse.json(
          { temperature: cached.temperature, cached: true },
          { status: 200 },
        );
      }
      return NextResponse.json(
        { temperature: config.weather.defaultTemp, fallback: true },
        { status: 200 },
      );
    }

    if (!response.ok) {
      throw new Error(`Weather API responded with status ${response.status}`);
    }

    const data = await response.json();
    const temperature: number = data?.current?.temperature_2m ?? config.weather.defaultTemp;

    cacheMap.set(cacheKey, { temperature, fetchedAt: Date.now() });

    return NextResponse.json({ temperature, cached: false }, { status: 200 });
  } catch (error) {
    console.error('Weather API error:', error);

    if (cached) {
      return NextResponse.json(
        { temperature: cached.temperature, cached: true },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { temperature: config.weather.defaultTemp, fallback: true },
      { status: 200 },
    );
  }
}
