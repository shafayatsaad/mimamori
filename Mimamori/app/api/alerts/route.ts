import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';
import { requireAuth } from '@/lib/auth/middleware';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

/**
 * GET /api/alerts — return unread in-app alerts for a user.
 *
 * Query params:
 *   - email (required): the user's email address
 *
 * DynamoDB key: PK = "USER#<email>", SK begins with "ALERT#"
 * Requirements: 9.3, 9.4
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

    const TABLE_NAME = getConfig().aws.dataTable;
    const pk = `USER#${email}`;

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'ALERT#',
        },
      }),
    );

    const alerts = (result.Items || []).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      message: item.message,
      read: item.read,
      createdAt: item.createdAt,
      ...(item.sourceDocId ? { sourceDocId: item.sourceDocId } : {}),
    }));

    return NextResponse.json({ alerts }, { status: 200 });
  } catch (error) {
    console.error('GET /api/alerts error:', error);

    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Data table not found` },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}

/**
 * POST /api/alerts — create an in-app alert in DynamoDB.
 *
 * Body fields:
 *   - email (required): the user's email address
 *   - type (required): "critical-finding" | "check-in" | "shared-insight" | "system"
 *   - title (required): alert title
 *   - message (required): alert message body
 *   - sourceDocId (optional): linked document ID for critical findings
 *
 * DynamoDB key: PK = "USER#<email>", SK = "ALERT#<timestamp>#<id>"
 * Requirements: 9.3, 9.4
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

    const TABLE_NAME = getConfig().aws.dataTable;
    const now = new Date();
    const id = crypto.randomUUID();
    const createdAt = now.toISOString();
    const pk = `USER#${email}`;
    const sk = `ALERT#${createdAt}#${id}`;

    const item: Record<string, unknown> = {
      PK: pk,
      SK: sk,
      id,
      type,
      title,
      message,
      read: false,
      createdAt,
    };

    if (sourceDocId) {
      item.sourceDocId = sourceDocId;
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    );

    return NextResponse.json(
      { alert: { id, type, title, message, read: false, createdAt, ...(sourceDocId ? { sourceDocId } : {}) } },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/alerts error:', error);

    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Data table not found` },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
