import { NextResponse } from 'next/server';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, getSessionCookieOptions } from '@/lib/auth/session';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch user from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: getConfig().aws.usersTable,
        Key: { email },
      })
    );

    const user = result.Item;

    if (!user) {
      // Generic error — don't reveal whether email exists
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password against stored bcrypt hash
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      // Generic error — don't reveal whether email or password was wrong
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Issue JWT via Session_Manager
    const token = await createSession({
      sub: user.email,
      name: user.name,
      role: user.role,
    });

    // Build response with user info (token goes in cookie only, not response body)
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, { status: 200 });

    // Set httpOnly session cookie
    const cookieOptions = getSessionCookieOptions();
    response.cookies.set(cookieOptions.name, token, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);

    const errorName = error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name)
      : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Users table '${getConfig().aws.usersTable}' was not found` },
        { status: 503 }
      );
    }

    if (errorName === 'AccessDeniedException' || errorName === 'UnrecognizedClientException') {
      return NextResponse.json(
        { error: 'AWS credentials/permissions are not configured for login' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: `Internal server error: ${getErrorMessage(error)}` }, { status: 500 });
  }
}
