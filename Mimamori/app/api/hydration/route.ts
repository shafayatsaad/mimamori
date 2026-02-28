import { NextResponse } from 'next/server';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig, getHydrationConfig } from '@/lib/config-service';
import { validateIntakeAmount, IntakeLog } from '@/lib/hydration';


const TABLE_NAME = getConfig().aws.dataTable;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const date = searchParams.get('date');

    if (!email || !date) {
      return NextResponse.json(
        { error: 'Missing email or date parameter' },
        { status: 400 },
      );
    }

    const pk = `USER#${email}`;
    const skPrefix = `HYDRATION#${date}`;

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': skPrefix,
        },
      }),
    );

    const logs: IntakeLog[] = (result.Items || []).map((item: any) => item.data);

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    console.error('Hydration GET error:', error);

    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Data table '${TABLE_NAME}' was not found` },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error fetching hydration logs' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, log } = body;

    if (!email || !log) {
      return NextResponse.json(
        { error: 'Missing required payload (email, log)' },
        { status: 400 },
      );
    }

    const { amount, timestamp } = log;

    // Load CarePlan for the patient (if any) and derive configurable bounds
    let carePlan = null;
    try {
      const { prisma } = await import('@/lib/prisma');
      carePlan = await prisma.carePlan.findUnique({ where: { patientEmail: email } });
    } catch (_err) {
      // CarePlan lookup failed — fall back to system defaults
    }
    const hydrationConfig = getHydrationConfig(carePlan);

    // Validate intake amount using configurable bounds
    if (!validateIntakeAmount(amount, { min: hydrationConfig.intakeMinMl, max: hydrationConfig.intakeMaxMl })) {
      return NextResponse.json(
        { error: `Invalid intake amount. Must be between ${hydrationConfig.intakeMinMl} and ${hydrationConfig.intakeMaxMl} mL.` },
        { status: 400 },
      );
    }

    const now = timestamp ? new Date(timestamp) : new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const logId = crypto.randomUUID();

    const intakeLog: IntakeLog = {
      id: logId,
      amount,
      timestamp: now.toISOString(),
      date,
    };

    const pk = `USER#${email}`;
    const sk = `HYDRATION#${date}#${logId}`;

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: pk,
          SK: sk,
          data: intakeLog,
        },
      }),
    );

    return NextResponse.json({ log: intakeLog }, { status: 201 });
  } catch (error) {
    console.error('Hydration POST error:', error);

    const errorName =
      error && typeof error === 'object' && 'name' in error
        ? String((error as { name?: string }).name)
        : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: `Data table '${TABLE_NAME}' was not found` },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error creating hydration log' },
      { status: 500 },
    );
  }
}
