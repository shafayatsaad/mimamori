import { NextResponse } from 'next/server';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';
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

    const config = getConfig();

    // Look up the reset token in DynamoDB (PK=RESET#<token>, SK=TOKEN)
    const tokenResult = await docClient.send(
      new GetCommand({
        TableName: config.aws.dataTable,
        Key: {
          PK: `RESET#${token}`,
          SK: 'TOKEN',
        },
      }),
    );

    const tokenRecord = tokenResult.Item;

    // Check: token exists, not expired, not already used
    if (!tokenRecord) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    const nowEpoch = Math.floor(Date.now() / 1000);

    if (tokenRecord.used || tokenRecord.expiresAt <= nowEpoch) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password);

    // Update the user's password in the users table
    await docClient.send(
      new UpdateCommand({
        TableName: config.aws.usersTable,
        Key: { email: tokenRecord.email },
        UpdateExpression: 'SET #pw = :pw',
        ExpressionAttributeNames: { '#pw': 'password' },
        ExpressionAttributeValues: { ':pw': hashedPassword },
      }),
    );

    // Mark the token as used so it cannot be reused
    await docClient.send(
      new UpdateCommand({
        TableName: config.aws.dataTable,
        Key: {
          PK: `RESET#${token}`,
          SK: 'TOKEN',
        },
        UpdateExpression: 'SET #used = :used',
        ExpressionAttributeNames: { '#used': 'used' },
        ExpressionAttributeValues: { ':used': true },
      }),
    );

    return NextResponse.json(
      { message: 'Password has been reset successfully.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Reset-password error:', error);

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
