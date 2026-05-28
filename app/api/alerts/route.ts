import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { requireAuth } from '@/lib/auth/middleware';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

/**
 * GET /api/alerts — return alerts for a user.
 */
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const alerts = (data || []).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      read: item.read,
      createdAt: item.created_at,
      ...(item.source_doc_id ? { sourceDocId: item.source_doc_id } : {}),
    }));

    return NextResponse.json({ alerts }, { status: 200 });
  } catch (error) {
    console.error('GET /api/alerts error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}

/**
 * POST /api/alerts — create an in-app alert.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const { email, type, title, message, sourceDocId } = body;

    if (!email || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: email, type, title, message' },
        { status: 400 },
      );
    }

    const validTypes = ['critical-finding', 'check-in', 'shared-insight', 'system'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid alert type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const createdAt = now.toISOString();

    const { error: insertError } = await supabase
      .from('alerts')
      .insert({
        id,
        email,
        type,
        title,
        message,
        read: false,
        created_at: createdAt,
        source_doc_id: sourceDocId || null,
      });

    if (insertError) {
      console.error('Error inserting alert:', insertError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    return NextResponse.json(
      { alert: { id, type, title, message, read: false, createdAt, ...(sourceDocId ? { sourceDocId } : {}) } },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/alerts error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
