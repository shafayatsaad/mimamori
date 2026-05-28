import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { generateResetToken } from '@/lib/auth/reset-token';
import { sendEmailWithRetry } from '@/lib/email-retry';

/** Identical success response — prevents email enumeration (Req 3.6). */
const SUCCESS_RESPONSE = {
  message: "If an account with that email exists, we've sent a password reset link.",
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: email' },
        { status: 400 },
      );
    }

    // Look up user in the users table
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching user for password reset:', userError);
    }

    // If user exists, generate token, store it, and send the email.
    // If user does NOT exist, skip silently — same response either way.
    if (user) {
      const token = generateResetToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3600 * 1000).toISOString(); // 1 hour ISO string

      // Store reset token in the reset_tokens table
      const { error: insertError } = await supabase
        .from('reset_tokens')
        .insert({
          token,
          email,
          created_at: now.toISOString(),
          expires_at: expiresAt,
          used: false,
        });

      if (insertError) {
        console.error('Error inserting reset token:', insertError);
        return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
      }

      // Build the reset link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send the email stub
      await sendEmailWithRetry({
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: {
            Data: 'Mimamori — Reset Your Password',
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: [
                'You requested a password reset for your Mimamori account.',
                '',
                `Click the link below to set a new password (valid for 1 hour):`,
                resetLink,
                '',
                'If you did not request this, you can safely ignore this email.',
                '',
                '— Mimamori Health Platform',
              ].join('\n'),
              Charset: 'UTF-8',
            },
          },
        },
        Source: 'noreply@mimamori.ai',
      });
    }

    // Always return the same 200 response (Req 3.6)
    return NextResponse.json(SUCCESS_RESPONSE, { status: 200 });
  } catch (error) {
    console.error('Forgot-password error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
