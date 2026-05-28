import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { hashPassword } from '@/lib/auth/password';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

const INVALID_TOKEN_MESSAGE =
  'This reset link has expired or is invalid. Please request a new one.';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: token and password' },
        { status: 400 },
      );
    }

    // Look up the reset token in Supabase
    const { data: tokenRecord, error: fetchError } = await supabase
      .from('reset_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching reset token:', fetchError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // Check: token exists, not expired, not already used
    if (!tokenRecord) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    const expiresAtMs = new Date(tokenRecord.expires_at).getTime();
    const nowMs = Date.now();

    if (tokenRecord.used || expiresAtMs <= nowMs) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update the user's password in the users table
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', tokenRecord.email);

    if (userUpdateError) {
      console.error('Error updating user password:', userUpdateError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // Mark the token as used so it cannot be reused
    const { error: tokenUpdateError } = await supabase
      .from('reset_tokens')
      .update({ used: true })
      .eq('token', token);

    if (tokenUpdateError) {
      console.error('Error marking token as used:', tokenUpdateError);
    }

    return NextResponse.json(
      { message: 'Password has been reset successfully.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Reset-password error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
