import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for /api/analyze-file route — critical findings and alert fallback.
 *
 * Validates: Requirements 9.3, 13.4
 */

// --- Mocks ---

const mockDocClientSend = vi.fn();
const mockSendEmailWithRetry = vi.fn();
const mockBedrockSend = vi.fn();
const mockComprehendSend = vi.fn();
const mockS3Send = vi.fn();
const mockTextractSend = vi.fn();

vi.mock('@/lib/dynamodb', () => ({
  default: { send: (...args: unknown[]) => mockDocClientSend(...args) },
}));

vi.mock('@/lib/email-retry', () => ({
  sendEmailWithRetry: (...args: unknown[]) => mockSendEmailWithRetry(...args),
}));

vi.mock('@/lib/critical-alerts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/critical-alerts')>('@/lib/critical-alerts');
  return actual;
});

vi.mock('@/lib/aws-clients', () => ({
  bedrockClient: { send: (...args: unknown[]) => mockBedrockSend(...args) },
  comprehendMedicalClient: { send: (...args: unknown[]) => mockComprehendSend(...args) },
  s3Client: { send: (...args: unknown[]) => mockS3Send(...args) },
  textractClient: { send: (...args: unknown[]) => mockTextractSend(...args) },
  sesClient: { send: vi.fn() },
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
    alert: { defaultSubject: 'Alert', defaultTemplate: 'Alert message' },
  }),
}));

// Import route handler after mocks
import { POST } from '@/app/api/analyze-file/route';
import { NextRequest } from 'next/server';

// --- Helpers ---

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/analyze-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockBedrockResponse(parsedData: Record<string, unknown>) {
  mockBedrockSend.mockResolvedValueOnce({
    output: {
      message: {
        content: [{ text: JSON.stringify(parsedData) }],
      },
    },
  });
}

function setupComprehendMock(entities: unknown[] = []) {
  mockComprehendSend.mockResolvedValue({ Entities: entities });
}

// --- Tests ---

describe('POST /api/analyze-file — critical findings and alert fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupComprehendMock();
    mockDocClientSend.mockResolvedValue({});
    // Set caregiver email env var
    process.env.AWS_CAREGIVER_EMAIL = 'caregiver@test.com';
  });

  describe('critical keyword detection (Req 13.4)', () => {
    it('flags response with criticalFinding when summary contains severity keywords', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Patient has a critical condition requiring immediate attention.',
        precautions: 'Monitor closely.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-1' });

      const res = await POST(makeRequest({ docName: 'test-doc.pdf', fileUrl: '' }));
      const body = await res.json();

      expect(body.criticalFinding).toBe(true);
      expect(body.criticalFindingMessage).toBe('Critical finding — review with your care team immediately');
    });

    it('does not flag response when no severity keywords are present', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'All results are within normal range.',
        precautions: 'Continue current medication.',
        biomarkers: [],
        medications: [],
      });

      const res = await POST(makeRequest({ docName: 'test-doc.pdf', fileUrl: '' }));
      const body = await res.json();

      expect(body.criticalFinding).toBeUndefined();
      expect(body.criticalFindingMessage).toBeUndefined();
    });

    it('detects "urgent" keyword in precautions', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Prescription',
        summary: 'Standard prescription review.',
        precautions: 'Urgent follow-up required within 48 hours.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-2' });

      const res = await POST(makeRequest({ docName: 'rx.pdf', fileUrl: '' }));
      const body = await res.json();

      expect(body.criticalFinding).toBe(true);
    });

    it('detects "life-threatening" keyword', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Doctor Note',
        summary: 'Patient presents with life-threatening allergic reaction history.',
        precautions: 'Carry epinephrine at all times.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-3' });

      const res = await POST(makeRequest({ docName: 'note.pdf', fileUrl: '' }));
      const body = await res.json();

      expect(body.criticalFinding).toBe(true);
    });
  });

  describe('SES alert fallback to DynamoDB (Req 9.3)', () => {
    it('stores alert in DynamoDB when SES fails after retries', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Emergency findings detected.',
        precautions: 'Seek immediate medical attention.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: false, error: 'SES unavailable' });

      const res = await POST(makeRequest({ docName: 'emergency-lab.pdf', fileUrl: '' }));
      const body = await res.json();

      // Should still return the analysis
      expect(body.summary).toContain('Emergency findings');
      expect(body.criticalFinding).toBe(true);

      // Should have stored fallback alert in DynamoDB
      expect(mockDocClientSend).toHaveBeenCalled();
      const putCall = mockDocClientSend.mock.calls.find(
        (call: unknown[]) => (call[0] as { constructor: { name: string } }).constructor.name === 'PutCommand'
      );
      expect(putCall).toBeDefined();

      const item = (putCall![0] as { input: { Item: Record<string, unknown> } }).input.Item;
      expect(item.PK).toBe('USER#caregiver@test.com');
      expect((item.SK as string)).toMatch(/^ALERT#/);
      expect(item.type).toBe('critical-finding');
      expect(item.read).toBe(false);
      expect(item.sourceDocId).toBe('emergency-lab.pdf');
      expect((item.message as string)).toContain('Email notification could not be delivered');
    });

    it('does not store DynamoDB alert when SES succeeds', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Critical lab values detected.',
        precautions: 'Immediate review needed.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-ok' });

      await POST(makeRequest({ docName: 'lab.pdf', fileUrl: '' }));

      // sendEmailWithRetry should have been called
      expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(1);
      // DynamoDB PutCommand should NOT have been called for alert storage
      const putCalls = mockDocClientSend.mock.calls.filter(
        (call: unknown[]) => (call[0] as { constructor: { name: string } }).constructor.name === 'PutCommand'
      );
      expect(putCalls).toHaveLength(0);
    });

    it('uses sendEmailWithRetry with maxRetries=3', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Urgent condition found.',
        precautions: 'Act immediately.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-retry' });

      await POST(makeRequest({ docName: 'urgent.pdf', fileUrl: '' }));

      expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(1);
      const [params, maxRetries] = mockSendEmailWithRetry.mock.calls[0];
      expect(maxRetries).toBe(3);
      expect(params.Destination.ToAddresses).toContain('caregiver@test.com');
    });

    it('does not attempt email or DynamoDB when no severity detected', async () => {
      mockBedrockResponse({
        extractedName: 'Test Patient',
        actualType: 'Insurance',
        summary: 'Standard insurance document.',
        precautions: 'No action needed.',
        biomarkers: [],
        medications: [],
      });

      await POST(makeRequest({ docName: 'insurance.pdf', fileUrl: '' }));

      expect(mockSendEmailWithRetry).not.toHaveBeenCalled();
      expect(mockDocClientSend).not.toHaveBeenCalled();
    });
  });
});
