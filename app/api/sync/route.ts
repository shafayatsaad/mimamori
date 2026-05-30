import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { requireAuth } from '@/lib/auth/middleware';
import { validateSyncRequest } from '@/lib/api-validation';

export async function GET(request: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Missing email parameter' }, { status: 400 });
    }

    // Verify user exists
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      console.error('Error verifying user:', userError);
    }

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Query all records for this user across proper relational tables
    const [stateResult, journalsResult, hydrationResult, documentsResult] = await Promise.all([
      supabase.from('user_state').select('*').eq('email', email).maybeSingle(),
      supabase.from('journals').select('data').eq('email', email),
      supabase.from('hydration_logs').select('data').eq('email', email),
      supabase.from('documents').select('data').eq('email', email),
    ]);

    // Reconstruct state
    const state: any = {
      profile: stateResult.data?.profile || {},
      caregivers: stateResult.data?.caregivers || [],
      invitations: stateResult.data?.invitations || [],
      appointments: stateResult.data?.appointments || [],
      customNotes: stateResult.data?.custom_notes || [],
      documents: (documentsResult.data || []).map((d: any) => d.data),
      logs: (journalsResult.data || []).map((j: any) => j.data),
      hydrationLogs: (hydrationResult.data || []).map((h: any) => h.data)
    };

    // Sort logs descending
    state.logs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ state }, { status: 200 });

  } catch (error) {
    console.error('Sync GET error:', error);
    return NextResponse.json({ error: 'Internal server error fetching state' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  try {
    const body = await request.json();

    // --- Request validation ---
    const validation = validateSyncRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { email, state } = body;

    if (!state) {
      return NextResponse.json({ error: 'Missing required payload: state' }, { status: 400 });
    }

    const promises: PromiseLike<any>[] = [];

    // 1. Upsert Profile (Main Record) in user_state table
    promises.push(
      supabase.from('user_state').upsert({
        email: email,
        profile: state.profile || {},
        caregivers: state.caregivers || [],
        invitations: state.invitations || [],
        appointments: state.appointments || [],
        custom_notes: state.customNotes || []
      })
    );

    // 2. Upsert Logs (Journals) in journals table
    for (const log of (state.logs || [])) {
        if (!log.id || !log.date) continue;
        promises.push(
          supabase.from('journals').upsert({
            id: log.id,
            email: email,
            date: log.date,
            data: log
          })
        );
    }

    // 3. Upsert Hydration Logs in hydration_logs table
    for (const log of (state.hydrationLogs || state.intakeLogs || [])) {
        if (!log.id || !log.date) continue;
        promises.push(
          supabase.from('hydration_logs').upsert({
            id: log.id,
            email: email,
            date: log.date,
            data: log
          })
        );
    }

    // 4. Upsert Documents in documents table
    for (const doc of (state.documents || [])) {
        if (!doc.id) continue;
        promises.push(
          supabase.from('documents').upsert({
            id: doc.id,
            email: email,
            type: doc.type || 'unknown',
            data: doc
          })
        );
    }

    const results = await Promise.all(promises);

    // Verify if any write failed
    const failedUpsert = results.find(res => res.error);
    if (failedUpsert) {
      console.error('Failed to sync one or more records:', failedUpsert.error);
      return NextResponse.json({ error: `Sync write error: ${failedUpsert.error.message}` }, { status: 503 });
    }

    return NextResponse.json({ message: 'State synced successfully utilizing relational Supabase tables' }, { status: 200 });
  } catch (error) {
    console.error('Sync POST error:', error);
    return NextResponse.json({ error: 'Internal server error syncing state' }, { status: 500 });
  }
}
