import { NextResponse } from 'next/server';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';
import { hashPassword } from '@/lib/auth/password';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists
    const checkUser = await docClient.send(
      new GetCommand({
        TableName: getConfig().aws.usersTable,
        Key: { email },
      })
    );

    if (checkUser.Item) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = {
      email,
      name,
      password: hashedPassword,
      role: role || 'patient',
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: getConfig().aws.usersTable,
        Item: newUser,
      })
    );

    return NextResponse.json({ message: 'User created successfully', user: { email: newUser.email, name: newUser.name, role: newUser.role } }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);

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
        { error: 'AWS credentials/permissions are not configured for signup' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: `Internal server error: ${getErrorMessage(error)}` }, { status: 500 });
  }
}
