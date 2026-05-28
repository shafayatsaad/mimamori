import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { getConfig, getHydrationConfig } from '@/lib/config-service';
import { validateIntakeAmount, IntakeLog } from '@/lib/hydration';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const date = searchParams.get('date');

    if (!email || !date) {
      return NextResponse.json(
        { error: 'Missing email or date parameter' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('hydration_logs')
      .select('data')
      .eq('email', email)
      .eq('date', date);

    if (error) {
      console.error('Error fetching hydration logs:', error);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const logs: IntakeLog[] = (data || []).map((item: any) => item.data);

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error('Hydration GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error fetching hydration logs' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, log } = body;

    if (!email || !log) {
      return NextResponse.json(
        { error: 'Missing required payload (email, log)' },
        { status: 400 },
      );
    }

    const { amount, timestamp } = log;

    // Load CarePlan for the patient (if any) and derive configurable bounds
    let carePlan = null;
    try {
      const { prisma } = await import('@/lib/prisma');
      carePlan = await prisma.carePlan.findUnique({ where: { patientEmail: email } });
    } catch (_err) {
      // CarePlan lookup failed — fall back to system defaults
    }
    const hydrationConfig = getHydrationConfig(carePlan);

    // Validate intake amount using configurable bounds
    if (!validateIntakeAmount(amount, { min: hydrationConfig.intakeMinMl, max: hydrationConfig.intakeMaxMl })) {
      return NextResponse.json(
        { error: `Invalid intake amount. Must be between ${hydrationConfig.intakeMinMl} and ${hydrationConfig.intakeMaxMl} mL.` },
        { status: 400 },
      );
    }

    const now = timestamp ? new Date(timestamp) : new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const logId = crypto.randomUUID();

    const intakeLog: IntakeLog = {
      id: logId,
      amount,
      timestamp: now.toISOString(),
      date,
    };

    const { error: insertError } = await supabase
      .from('hydration_logs')
      .insert({
        id: logId,
        email,
        date,
        data: intakeLog,
      });

    if (insertError) {
      console.error('Error inserting hydration log:', insertError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    return NextResponse.json({ log: intakeLog }, { status: 201 });
  } catch (error) {
    console.error('Hydration POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error creating hydration log' },
      { status: 500 },
    );
  }
}
