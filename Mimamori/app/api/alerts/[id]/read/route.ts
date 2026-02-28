import { NextResponse } from 'next/server';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

/**
 * PATCH /api/alerts/[id]/read — mark an alert as read in DynamoDB.
 *
 * Body fields:
 *   - email (required): the user's email address
 *
 * The alert's SK is discovered by querying for ALERT# items matching the id.
 * Requirements: 9.5
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

    const TABLE_NAME = getConfig().aws.dataTable;
    const pk = `USER#${email}`;

    // Find the alert's full SK by querying ALERT# items for this user
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'ALERT#',
        },
      }),
    );

    const alertItem = (queryResult.Items || []).find((item) => item.id === id);

    if (!alertItem) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    // Update the alert's read flag
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: pk,
          SK: alertItem.SK,
        },
        UpdateExpression: 'SET #read = :read',
        ExpressionAttributeNames: {
          '#read': 'read',
        },
        ExpressionAttributeValues: {
          ':read': true,
        },
      }),
    );

    return NextResponse.json({ message: 'Alert marked as read' }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/alerts/[id]/read error:', error);

    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: 'Data table not found' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Internal server error: ${getErrorMessage(error)}` },
      { status: 500 },
    );
  }
}
