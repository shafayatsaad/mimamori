import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

/**
 * PATCH /api/alerts/[id]/read — mark an alert as read in Supabase.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Missing required field: email' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing alert id' }, { status: 400 });
    }

    // Update the alert's read flag in Supabase directly
    const { data, error } = await supabase
      .from('alerts')
      .update({ read: true })
      .eq('id', id)
      .eq('email', email)
      .select();

    if (error) {
      console.error('Error marking alert as read:', error);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Alert marked as read' }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/alerts/[id]/read error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
