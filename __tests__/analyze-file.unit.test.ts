import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for /api/analyze-file route — critical findings and alert fallback.
 *
 * Validates: Requirements 9.3, 13.4
 */

// --- Mocks ---

const mockGenerateText = vi.fn();
const mockGenerateWithFile = vi.fn();
const mockMedicalAiAnalyze = vi.fn();
const mockSendEmailWithRetry = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockSupabaseStorageFrom = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockSupabaseStorageFrom(...args),
    },
  },
}));

vi.mock('@/lib/gemini-client', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateWithFile: (...args: unknown[]) => mockGenerateWithFile(...args),
}));

vi.mock('@/lib/medical-ai', () => ({
  medicalAi: {
    analyze: (...args: unknown[]) => mockMedicalAiAnalyze(...args),
  },
}));

vi.mock('@/lib/email-retry', () => ({
  sendEmailWithRetry: (...args: unknown[]) => mockSendEmailWithRetry(...args),
}));

vi.mock('@/lib/critical-alerts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/critical-alerts')>('@/lib/critical-alerts');
  return actual;
});

vi.mock('@/lib/config-service', () => ({
  getConfig: () => ({
    session: { jwtSecret: 'test-secret', expirySeconds: 86400 },
    alert: { defaultSubject: 'Alert', defaultTemplate: 'Alert message' },
  }),
}));

vi.mock('@/lib/auth/middleware', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    authenticated: true,
    user: { sub: 'user@test.com', name: 'Test User', role: 'patient' },
  }),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('@/lib/circuit-breaker', () => ({
  callWithCircuitBreaker: vi.fn((_service: string, fn: () => unknown) => fn()),
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

function mockGeminiResponse(parsedData: Record<string, unknown>) {
  mockGenerateText.mockResolvedValueOnce(JSON.stringify(parsedData));
}

function createSupabaseInsertChain() {
  return {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

// --- Tests ---

describe('POST /api/analyze-file — critical findings and alert fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMedicalAiAnalyze.mockResolvedValue([]);
    mockSupabaseFrom.mockReturnValue(createSupabaseInsertChain());
    // Set caregiver email env var
    process.env.AWS_CAREGIVER_EMAIL = 'caregiver@test.com';
  });

  describe('critical keyword detection (Req 13.4)', () => {
    it('flags response with criticalFinding when summary contains severity keywords', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Patient has a critical condition requiring immediate attention.',
        precautions: 'Monitor closely.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-1' });

      const res = await POST(makeRequest({ docName: 'test-doc.pdf', fileUrl: 'test-doc-url' }));
      const body = await res.json();

      expect(body.criticalFinding).toBe(true);
      expect(body.criticalFindingMessage).toBe('Critical finding — review with your care team immediately');
    });

    it('does not flag response when no severity keywords are present', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'All results are within normal range.',
        precautions: 'Continue current medication.',
        biomarkers: [],
        medications: [],
      });

      const res = await POST(makeRequest({ docName: 'test-doc.pdf', fileUrl: 'test-doc-url' }));
      const body = await res.json();

      expect(body.criticalFinding).toBeUndefined();
      expect(body.criticalFindingMessage).toBeUndefined();
    });

    it('detects "urgent" keyword in precautions', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Prescription',
        summary: 'Standard prescription review.',
        precautions: 'Urgent follow-up required within 48 hours.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-2' });

      const res = await POST(makeRequest({ docName: 'rx.pdf', fileUrl: 'test-doc-url' }));
      const body = await res.json();

      expect(body.criticalFinding).toBe(true);
    });

    it('detects "life-threatening" keyword', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Doctor Note',
        summary: 'Patient presents with life-threatening allergic reaction history.',
        precautions: 'Carry epinephrine at all times.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-3' });

      const res = await POST(makeRequest({ docName: 'note.pdf', fileUrl: 'test-doc-url' }));
      const body = await res.json();

      expect(body.criticalFinding).toBe(true);
    });
  });

  describe('Alert fallback to Supabase (Req 9.3)', () => {
    it('stores alert in Supabase when email fails after retries', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Emergency findings detected.',
        precautions: 'Seek immediate medical attention.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: false, error: 'Email unavailable' });

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue({ insert: insertMock });

      const res = await POST(makeRequest({ docName: 'emergency-lab.pdf', fileUrl: 'test-doc-url' }));
      const body = await res.json();

      // Should still return the analysis
      expect(body.summary).toContain('Emergency findings');
      expect(body.criticalFinding).toBe(true);

      // Should have stored fallback alert in Supabase
      expect(mockSupabaseFrom).toHaveBeenCalledWith('alerts');
      expect(insertMock).toHaveBeenCalled();
    });

    it('uses sendEmailWithRetry with maxRetries=3', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Lab Result',
        summary: 'Urgent condition found.',
        precautions: 'Act immediately.',
        biomarkers: [],
        medications: [],
      });
      mockSendEmailWithRetry.mockResolvedValue({ success: true, messageId: 'msg-retry' });

      await POST(makeRequest({ docName: 'urgent.pdf', fileUrl: 'test-doc-url' }));

      expect(mockSendEmailWithRetry).toHaveBeenCalledTimes(1);
      const [params, maxRetries] = mockSendEmailWithRetry.mock.calls[0];
      expect(maxRetries).toBe(3);
      expect(params.Destination.ToAddresses).toContain('caregiver@test.com');
    });

    it('does not attempt email or alert when no severity detected', async () => {
      mockGeminiResponse({
        extractedName: 'Test Patient',
        actualType: 'Insurance',
        summary: 'Standard insurance document.',
        precautions: 'No action needed.',
        biomarkers: [],
        medications: [],
      });

      await POST(makeRequest({ docName: 'insurance.pdf', fileUrl: 'test-doc-url' }));

      expect(mockSendEmailWithRetry).not.toHaveBeenCalled();
    });
  });
});
