import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for /api/alerts routes (GET, POST) and /api/alerts/[id]/read (PATCH).
 *
 * Validates: Requirements 9.3, 9.4, 9.5
 */

// --- In-memory alert store ---

let alertStore: Record<string, Record<string, unknown>>;

function resetStore() {
  alertStore = {};
}

// --- Supabase mock ---

const supabaseMock = {
  from: vi.fn(),
};

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(Promise.resolve(result));
  chain.insert = vi.fn().mockReturnValue(Promise.resolve(result));
  chain.update = vi.fn().mockReturnValue(chain);
  chain.match = vi.fn().mockReturnValue(Promise.resolve(result));
  return chain;
}

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseMock.from(...args),
  },
}));

vi.mock('@/lib/config-service', () => ({
  getConfig: () => ({
    session: { jwtSecret: 'test-secret', expirySeconds: 86400 },
  }),
}));

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    authenticated: true,
    user: { sub: 'user@test.com', name: 'Test User', role: 'patient' },
  }),
}));

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
    supabaseMock.from.mockReset();
  });

  it('returns 400 when email is missing', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing email parameter');
  });

  it('returns empty alerts array when no alerts exist', async () => {
    const chain = createChainMock({ data: [], error: null });
    supabaseMock.from.mockReturnValue(chain);

    const res = await GET(makeGetRequest('user@test.com'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toEqual([]);
  });

  it('returns alerts for the given user', async () => {
    const chain = createChainMock({
      data: [
        {
          id: 'abc-123',
          type: 'system',
          title: 'Test Alert',
          message: 'This is a test',
          read: false,
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });
    supabaseMock.from.mockReturnValue(chain);

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
    const chain = createChainMock({
      data: [
        {
          id: 'doc-alert',
          type: 'critical-finding',
          title: 'Critical Finding',
          message: 'Urgent review needed',
          read: false,
          created_at: '2024-01-01T00:00:00.000Z',
          source_doc_id: 'doc-456',
        },
      ],
      error: null,
    });
    supabaseMock.from.mockReturnValue(chain);

    const res = await GET(makeGetRequest('user@test.com'));
    const body = await res.json();
    expect(body.alerts[0].sourceDocId).toBe('doc-456');
  });
});

describe('POST /api/alerts', () => {
  beforeEach(() => {
    resetStore();
    supabaseMock.from.mockReset();
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
    const chain = createChainMock({ data: null, error: null });
    supabaseMock.from.mockReturnValue(chain);

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

  it('includes sourceDocId when provided', async () => {
    const chain = createChainMock({ data: null, error: null });
    supabaseMock.from.mockReturnValue(chain);

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
      const chain = createChainMock({ data: null, error: null });
      supabaseMock.from.mockReturnValue(chain);

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
    supabaseMock.from.mockReset();
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
    // First call: select query returns empty
    const selectChain = createChainMock({ data: [], error: null });
    supabaseMock.from.mockReturnValue(selectChain);

    const res = await PATCH(
      makePatchRequest('nonexistent', { email: 'user@test.com' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Alert not found');
  });

  it('marks an existing alert as read', async () => {
    // First call: select query returns the alert
    const selectChain = createChainMock({
      data: [{ id: 'my-alert', email: 'user@test.com', read: false }],
      error: null,
    });
    // Second call: update
    const updateChain = createChainMock({ data: null, error: null });

    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectChain : updateChain;
    });

    const res = await PATCH(
      makePatchRequest('my-alert', { email: 'user@test.com' }),
      { params: Promise.resolve({ id: 'my-alert' }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Alert marked as read');
  });
});
