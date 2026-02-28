import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';

// Feature: mimamori-reliability-audit, Property 17: Auth middleware rejects unauthenticated requests

/**
 * Property 17: Auth middleware rejects unauthenticated requests
 *
 * For any request to a protected API route that lacks a valid session cookie
 * (missing, expired, or malformed JWT), the auth middleware should return a
 * 401 response with message "Authentication required".
 *
 * **Validates: Requirements 27.2**
 */

// Mock the session module so verifySession returns null for any token
// and getSessionCookieOptions returns a known cookie name.
vi.mock('@/lib/auth/session', () => ({
  verifySession: vi.fn().mockResolvedValue(null),
  getSessionCookieOptions: vi.fn().mockReturnValue({
    name: 'mimamori_session',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 86400,
  }),
}));

import { requireAuth } from '@/lib/auth/middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest for a protected API route, optionally with a cookie. */
function buildRequest(cookieValue?: string): NextRequest {
  const url = 'http://localhost:3000/api/sync';
  const req = new NextRequest(url, { method: 'GET' });
  if (cookieValue !== undefined) {
    req.cookies.set('mimamori_session', cookieValue);
  }
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 17: Auth middleware rejects unauthenticated requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without a session cookie with 401', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate arbitrary protected route paths
        fc.constantFrom(
          '/api/sync',
          '/api/medical-reasoning',
          '/api/analyze-file',
          '/api/send-alert',
          '/api/alerts',
          '/api/upload',
          '/api/download',
        ),
        async (routePath) => {
          const req = new NextRequest(`http://localhost:3000${routePath}`, {
            method: 'POST',
          });
          // No cookie set

          const result = await requireAuth(req);

          expect(result.authenticated).toBe(false);
          if (!result.authenticated) {
            expect(result.response.status).toBe(401);
            const body = await result.response.json();
            expect(body).toEqual({ error: 'Authentication required' });
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('rejects requests with a random/malformed cookie value with 401', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate arbitrary non-empty strings as malformed tokens
        fc.string({ minLength: 1, maxLength: 500 }),
        async (malformedToken) => {
          const req = buildRequest(malformedToken);

          const result = await requireAuth(req);

          expect(result.authenticated).toBe(false);
          if (!result.authenticated) {
            expect(result.response.status).toBe(401);
            const body = await result.response.json();
            expect(body).toEqual({ error: 'Authentication required' });
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('always returns { error: "Authentication required" } in the 401 response body', () => {
    fc.assert(
      fc.asyncProperty(
        // Mix of missing and malformed cookies
        fc.option(fc.string({ minLength: 0, maxLength: 300 }), { nil: undefined }),
        async (maybeCookie) => {
          const req = buildRequest(maybeCookie);

          const result = await requireAuth(req);

          expect(result.authenticated).toBe(false);
          if (!result.authenticated) {
            expect(result.response.status).toBe(401);
            const body = await result.response.json();
            expect(body.error).toBe('Authentication required');
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
