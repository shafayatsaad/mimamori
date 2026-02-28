import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';
import { getConfig } from '@/lib/config-service';
import { requireAuth } from '@/lib/auth/middleware';
import { validateSyncRequest } from '@/lib/api-validation';

const TABLE_NAME = getConfig().aws.dataTable;

export async function GET(request: NextRequest) {
  // --- Auth ---
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

    const pk = `USER#${email}`;

    // Query all records for this user using single-table design
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk
        }
      })
    );

    const items = result.Items || [];
    if (items.length === 0) {
       return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Reconstruct state from single-table items
    const state: any = {
      profile: {},
      caregivers: [],
      documents: [],
      logs: [],
      invitations: [],
      appointments: [],
      customNotes: [],
      hydrationLogs: []
    };

    for (const item of items) {
       if (item.SK === 'PROFILE') {
          state.profile = item.profile || {};
          state.caregivers = item.caregivers || [];
          state.invitations = item.invitations || [];
          state.appointments = item.appointments || [];
          state.customNotes = item.customNotes || [];
       } else if (item.SK.startsWith('JOURNAL#')) {
          state.logs.push(item.data);
       } else if (item.SK.startsWith('FACT#') || item.SK.startsWith('DOC#')) {
          state.documents.push(item.data);
       } else if (item.SK.startsWith('HYDRATION#')) {
          state.hydrationLogs.push(item.data);
       }
    }

    // Sort logs descending
    state.logs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ state }, { status: 200 });

  } catch (error) {
    console.error('Sync GET error:', error);

    const errorName = error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name)
      : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json({ error: `Data table '${TABLE_NAME}' was not found` }, { status: 503 });
    }

    return NextResponse.json({ error: 'Internal server error fetching state' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  try {
    const body = await request.json();

    // --- Request validation ---
    const validation = validateSyncRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { email, state } = body;

    if (!state) {
      return NextResponse.json({ error: 'Missing required payload: state' }, { status: 400 });
    }

    const pk = `USER#${email}`;
    const promises: Promise<any>[] = [];

    // 1. Upsert Profile (Main Record)
    promises.push(
      docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
             PK: pk,
             SK: 'PROFILE',
             email: email,
             profile: state.profile || {},
             caregivers: state.caregivers || [],
             invitations: state.invitations || [],
             appointments: state.appointments || [],
             customNotes: state.customNotes || []
          }
        })
      )
    );

    // 2. Upsert Logs (Journals)
    for (const log of (state.logs || [])) {
        if (!log.id || !log.date) continue;
        let dateKey = log.id; // fallback
        try {
          // If the date is just a time string like "10:30 AM", Date parsing will fail.
          const d = new Date(log.date);
          if (!isNaN(d.getTime())) {
             dateKey = d.toISOString();
          } else {
             // It's a time string or invalid date. Use today's date + time string instead.
             dateKey = new Date().toISOString().split('T')[0] + 'T' + log.date.replace(/[^a-zA-Z0-9]/g, '');
          }
        } catch (e) {
             dateKey = log.id;
        }

        promises.push(
           docClient.send(
             new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                   PK: pk,
                   SK: `JOURNAL#${dateKey}#${log.id}`,
                   data: log
                }
             })
           )
        );
    }

    // 3. Upsert Hydration Logs
    for (const log of (state.hydrationLogs || state.intakeLogs || [])) {
        if (!log.id || !log.date) continue;
        promises.push(
           docClient.send(
             new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                   PK: pk,
                   SK: `HYDRATION#${log.date}#${log.id}`,
                   data: log
                }
             })
           )
        );
    }

    // 4. Upsert Documents & Facts
    for (const doc of (state.documents || [])) {
        if (!doc.id) continue;
        promises.push(
           docClient.send(
             new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                   PK: pk,
                   SK: `DOC#${doc.type}#${doc.id}`,
                   data: doc
                }
             })
           )
        );
    }

    await Promise.all(promises);

    return NextResponse.json({ message: 'State synced successfully utilizing Single-Table Design' }, { status: 200 });
  } catch (error) {
    console.error('Sync POST error:', error);

    const errorName = error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: string }).name)
      : '';

    if (errorName === 'ResourceNotFoundException') {
      return NextResponse.json({ error: `Data table '${TABLE_NAME}' was not found` }, { status: 503 });
    }

    return NextResponse.json({ error: 'Internal server error syncing state' }, { status: 500 });
  }
}
