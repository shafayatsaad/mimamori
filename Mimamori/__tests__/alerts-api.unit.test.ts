import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for /api/alerts routes (GET, POST) and /api/alerts/[id]/read (PATCH).
 *
 * Validates: Requirements 9.3, 9.4, 9.5
 */

// --- In-memory DynamoDB store ---

let alertStore: Record<string, Record<string, unknown>>;

function resetStore() {
  alertStore = {};
}

// --- Mocks ---

const mockDocClientSend = vi.fn();

vi.mock('@/lib/dynamodb', () => ({
  default: { send: (...args: unknown[]) => mockDocClientSend(...args) },
}));

vi.mock('@/lib/aws-clients', () => ({
  sesClient: { send: vi.fn().mockResolvedValue({ MessageId: 'mock-msg-id' }) },
  docClient: { send: (...args: unknown[]) => mockDocClientSend(...args) },
}));

vi.mock('@/lib/config-service', () => ({
  getConfig: () => ({
    aws: {
      region: 'us-east-1',
      usersTable: 'test-users',
      dataTable: 'test-data',
      sesFromEmail: 'noreply@test.com',
      s3BucketName: 'test-bucket',
      bedrockRouterArn: 'arn:aws:bedrock:us-east-1:000000000000:router/test',
    },
    session: { jwtSecret: 'test-secret', expirySeconds: 86400 },
  }),
}));

function setupDynamoMock() {
  mockDocClientSend.mockImplementation((command: { input: Record<string, unknown>; constructor: { name: string } }) => {
    const cmdName = command.constructor.name;
    const input = command.input as Record<string, unknown>;

    if (cmdName === 'QueryCommand') {
      const exprValues = input.ExpressionAttributeValues as Record<string, string>;
      const pk = exprValues[':pk'];
      // Return all alerts for this PK
      const items = Object.entries(alertStore)
        .filter(([key]) => key.startsWith(`${pk}|ALERT#`))
        .map(([, item]) => item);
      return Promise.resolve({ Items: items });
    }

    if (cmdName === 'PutCommand') {
      const item = input.Item as Record<string, unknown>;
      const pk = item.PK as string;
      const sk = item.SK as string;
      alertStore[`${pk}|${sk}`] = { ...item };
      return Promise.resolve({});
    }

    if (cmdName === 'UpdateCommand') {
      const key = input.Key as Record<string, string>;
      const pk = key.PK;
      const sk = key.SK;
      const storeKey = `${pk}|${sk}`;
      if (alertStore[storeKey]) {
        alertStore[storeKey].read = true;
      }
      return Promise.resolve({});
    }

    return Promise.resolve({});
  });
}

// Import route handlers after mocks
import { GET, POST } from '@/app/api/alerts/route';
import { PATCH } from '@/app/api/alerts/[id]/read/route';

// --- Helpers ---

function makeGetRequest(email?: string): Request {
  const url = email
    ? `http://localhost:3000/api/alerts?email=${encodeURIComponent(email)}`
    : 'http://localhost:3000/api/alerts';
  return new Request(url, { method: 'GET' });
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(id: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/alerts/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// --- Tests ---

describe('GET /api/alerts', () => {
  beforeEach(() => {
    resetStore();
    mockDocClientSend.mockReset();
    setupDynamoMock();
  });

  it('returns 400 when email is missing', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing email parameter');
  });

  it('returns empty alerts array when no alerts exist', async () => {
    const res = await GET(makeGetRequest('user@test.com'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toEqual([]);
  });

  it('returns alerts for the given user', async () => {
    // Seed an alert
    const pk = 'USER#user@test.com';
    const sk = 'ALERT#2024-01-01T00:00:00.000Z#abc-123';
    alertStore[`${pk}|${sk}`] = {
      PK: pk,
      SK: sk,
      id: 'abc-123',
      type: 'system',
      title: 'Test Alert',
      message: 'This is a test',
      read: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const res = await GET(makeGetRequest('user@test.com'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0]).toEqual({
      id: 'abc-123',
      type: 'system',
      title: 'Test Alert',
      message: 'This is a test',
      read: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('includes sourceDocId when present', async () => {
    const pk = 'USER#user@test.com';
    const sk = 'ALERT#2024-01-01T00:00:00.000Z#doc-alert';
    alertStore[`${pk}|${sk}`] = {
      PK: pk,
      SK: sk,
      id: 'doc-alert',
      type: 'critical-finding',
      title: 'Critical Finding',
      message: 'Urgent review needed',
      read: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      sourceDocId: 'doc-456',
    };

    const res = await GET(makeGetRequest('user@test.com'));
    const body = await res.json();
    expect(body.alerts[0].sourceDocId).toBe('doc-456');
  });

  it('does not return alerts for a different user', async () => {
    const pk = 'USER#other@test.com';
    const sk = 'ALERT#2024-01-01T00:00:00.000Z#other-alert';
    alertStore[`${pk}|${sk}`] = {
      PK: pk,
      SK: sk,
      id: 'other-alert',
      type: 'system',
      title: 'Other Alert',
      message: 'Not for this user',
      read: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const res = await GET(makeGetRequest('user@test.com'));
    const body = await res.json();
    expect(body.alerts).toEqual([]);
  });
});

describe('POST /api/alerts', () => {
  beforeEach(() => {
    resetStore();
    mockDocClientSend.mockReset();
    setupDynamoMock();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({ email: 'user@test.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('returns 400 for invalid alert type', async () => {
    const res = await POST(makePostRequest({
      email: 'user@test.com',
      type: 'invalid-type',
      title: 'Test',
      message: 'Test message',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid alert type');
  });

  it('creates an alert and returns 201', async () => {
    const res = await POST(makePostRequest({
      email: 'user@test.com',
      type: 'system',
      title: 'New Alert',
      message: 'Alert body text',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.alert).toBeDefined();
    expect(body.alert.type).toBe('system');
    expect(body.alert.title).toBe('New Alert');
    expect(body.alert.message).toBe('Alert body text');
    expect(body.alert.read).toBe(false);
    expect(body.alert.id).toBeDefined();
    expect(body.alert.createdAt).toBeDefined();
  });

  it('stores alert in DynamoDB with correct key structure', async () => {
    await POST(makePostRequest({
      email: 'user@test.com',
      type: 'check-in',
      title: 'Check In',
      message: 'How are you?',
    }));

    const keys = Object.keys(alertStore);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^USER#user@test\.com\|ALERT#/);
  });

  it('includes sourceDocId when provided', async () => {
    const res = await POST(makePostRequest({
      email: 'user@test.com',
      type: 'critical-finding',
      title: 'Critical',
      message: 'Urgent finding',
      sourceDocId: 'doc-789',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.alert.sourceDocId).toBe('doc-789');
  });

  it('accepts all valid alert types', async () => {
    const validTypes = ['critical-finding', 'check-in', 'shared-insight', 'system'];
    for (const type of validTypes) {
      resetStore();
      const res = await POST(makePostRequest({
        email: 'user@test.com',
        type,
        title: `${type} alert`,
        message: 'Test',
      }));
      expect(res.status).toBe(201);
    }
  });
});

describe('PATCH /api/alerts/[id]/read', () => {
  beforeEach(() => {
    resetStore();
    mockDocClientSend.mockReset();
    setupDynamoMock();
  });

  it('returns 400 when email is missing', async () => {
    const res = await PATCH(
      makePatchRequest('alert-id', {}),
      { params: Promise.resolve({ id: 'alert-id' }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required field: email');
  });

  it('returns 404 when alert is not found', async () => {
    const res = await PATCH(
      makePatchRequest('nonexistent', { email: 'user@test.com' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Alert not found');
  });

  it('marks an existing alert as read', async () => {
    // Seed an alert
    const pk = 'USER#user@test.com';
    const sk = 'ALERT#2024-01-01T00:00:00.000Z#my-alert';
    alertStore[`${pk}|${sk}`] = {
      PK: pk,
      SK: sk,
      id: 'my-alert',
      type: 'system',
      title: 'Test',
      message: 'Test',
      read: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const res = await PATCH(
      makePatchRequest('my-alert', { email: 'user@test.com' }),
      { params: Promise.resolve({ id: 'my-alert' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Alert marked as read');

    // Verify the store was updated
    expect(alertStore[`${pk}|${sk}`].read).toBe(true);
  });
});
