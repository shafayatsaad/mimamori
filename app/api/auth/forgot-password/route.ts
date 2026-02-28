import { NextResponse } from 'next/server';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';
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

    const config = getConfig();

    // Look up user in the users table (keyed by email)
    const userResult = await docClient.send(
      new GetCommand({
        TableName: config.aws.usersTable,
        Key: { email },
      }),
    );

    // If user exists, generate token, store it, and send the email.
    // If user does NOT exist, skip silently — same response either way.
    if (userResult.Item) {
      const token = generateResetToken();
      const now = new Date();
      const expiresAt = Math.floor(now.getTime() / 1000) + 3600; // 1 hour TTL

      // Store reset token in the data table (single-table design)
      await docClient.send(
        new PutCommand({
          TableName: config.aws.dataTable,
          Item: {
            PK: `RESET#${token}`,
            SK: 'TOKEN',
            email,
            createdAt: now.toISOString(),
            expiresAt, // DynamoDB TTL (Unix epoch seconds)
            used: false,
          },
        }),
      );

      // Build the reset link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/reset-password?token=${token}`;

      // Send the email via SES with retry
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
        Source: config.aws.sesFromEmail,
      });
    }

    // Always return the same 200 response (Req 3.6)
    return NextResponse.json(SUCCESS_RESPONSE, { status: 200 });
  } catch (error) {
    console.error('Forgot-password error:', error);

    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: 'Database table not found' },
        { status: 503 },
      );
    }

    if (
      errorName === 'AccessDeniedException' ||
      errorName === 'UnrecognizedClientException'
    ) {
      return NextResponse.json(
        { error: 'AWS credentials/permissions are not configured' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
