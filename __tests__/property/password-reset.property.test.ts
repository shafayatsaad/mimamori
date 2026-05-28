import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Feature: mimamori-production-readiness, Property 2: Password reset round trip
// Feature: mimamori-production-readiness, Property 3: Email enumeration prevention

/**
 * Property 2: Password reset round trip
 *
 * *For any* valid email and random new password, generating a reset token, then
 * using that token to reset the password, should result in: (a) the new password
 * verifying successfully against the stored hash, and (b) the used token being
 * invalidated (subsequent reset attempts with the same token fail).
 *
 * **Validates: Requirements 3.2, 3.4**
 *
 * Property 3: Email enumeration prevention
 *
 * *For any* email address (whether it exists in the system or not), the
 * forgot-password endpoint should return an identical HTTP status code and
 * response body shape, making it impossible to distinguish existing from
 * non-existing accounts.
 *
 * **Validates: Requirements 3.6**
 */

// --- In-memory Store ---

let usersStore: Record<string, any>;
let resetTokensStore: Record<string, any>;
let capturedToken: string | null;

function resetStores() {
  usersStore = {};
  resetTokensStore = {};
  capturedToken = null;
}

// --- Mocks ---

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (table: string) => {
      return {
        select: (fields: string) => {
          return {
            eq: (field: string, value: any) => {
              return {
                maybeSingle: async () => {
                  if (table === 'users') {
                    const user = usersStore[value];
                    return { data: user || null, error: null };
                  }
                  if (table === 'reset_tokens') {
                    const record = resetTokensStore[value];
                    return { data: record || null, error: null };
                  }
                  return { data: null, error: null };
                }
              };
            }
          };
        },
        insert: async (data: any) => {
          if (table === 'reset_tokens') {
            resetTokensStore[data.token] = { ...data };
          }
          return { error: null };
        },
        update: (updateData: any) => {
          return {
            eq: async (field: string, value: any) => {
              if (table === 'users') {
                if (usersStore[value]) {
                  Object.assign(usersStore[value], updateData);
                }
              }
              if (table === 'reset_tokens') {
                if (resetTokensStore[value]) {
                  Object.assign(resetTokensStore[value], updateData);
                }
              }
              return { error: null };
            }
          };
        }
      };
    }
  }
}));

vi.mock('@/lib/config-service', () => ({
  getConfig: () => ({
    supabase: {
      url: 'https://example.supabase.co',
      publishableKey: 'test-pub-key',
      storageBucket: 'documents',
    },
    session: { jwtSecret: 'test-secret', expirySeconds: 86400 },
  }),
}));

vi.mock('@/lib/email-retry', () => ({
  sendEmailWithRetry: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-msg' }),
}));

// Mock generateResetToken to capture the token for round-trip testing
vi.mock('@/lib/auth/reset-token', () => ({
  generateResetToken: () => {
    const token = 'mock-token-' + Math.random().toString(36).slice(2, 10);
    capturedToken = token;
    return token;
  },
}));

// Real password hashing for round-trip verification
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// Import route handlers after mocks
import { POST as forgotPasswordPOST } from '@/app/api/auth/forgot-password/route';
import { POST as resetPasswordPOST } from '@/app/api/auth/reset-password/route';

// --- Helpers ---

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}



// --- Arbitraries ---

const emailArb = fc.tuple(
  fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
  fc.stringMatching(/^[a-z][a-z0-9]{1,6}$/),
  fc.constantFrom('com', 'org', 'net', 'io'),
).map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

const passwordArb = fc.string({ minLength: 6, maxLength: 30 }).filter(s => s.trim().length >= 6);

// --- Tests ---

describe('Property 2: Password reset round trip', () => {
  beforeEach(() => {
    resetStores();
  });

  it('forgot-password → reset-password succeeds, then same token is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, passwordArb, async (email, newPassword) => {
        resetStores();

        // Seed user in store
        usersStore[email] = { email, password: await hashPassword('old-password-123') };

        // Step 1: Call forgot-password
        const forgotReq = makeRequest({ email });
        const forgotRes = await forgotPasswordPOST(forgotReq);
        expect(forgotRes.status).toBe(200);

        const forgotBody = await forgotRes.json();
        expect(forgotBody.message).toBe(
          "If an account with that email exists, we've sent a password reset link.",
        );

        // Verify token was stored
        expect(capturedToken).toBeTruthy();
        const token = capturedToken!;

        // Step 2: Call reset-password with valid token
        const resetReq = makeRequest({ token, password: newPassword });
        const resetRes = await resetPasswordPOST(resetReq);
        expect(resetRes.status).toBe(200);

        const resetBody = await resetRes.json();
        expect(resetBody.message).toBe('Password has been reset successfully.');

        // Step 3: Verify the new password was stored correctly
        const storedHash = usersStore[email].password as string;
        const passwordValid = await verifyPassword(newPassword, storedHash);
        expect(passwordValid).toBe(true);

        // Step 4: Same token should now be rejected (used)
        const replayReq = makeRequest({ token, password: 'another-password' });
        const replayRes = await resetPasswordPOST(replayReq);
        expect(replayRes.status).toBe(400);

        const replayBody = await replayRes.json();
        expect(replayBody.error).toBe(
          'This reset link has expired or is invalid. Please request a new one.',
        );
      }),
      { numRuns: 10 },
    );
  }, 60_000);
});

describe('Property 3: Email enumeration prevention', () => {
  beforeEach(() => {
    resetStores();
  });

  it('forgot-password returns identical status and body shape for existing and non-existing emails', async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, fc.boolean(), async (email, userExists) => {
        resetStores();

        // Conditionally seed user
        if (userExists) {
          usersStore[email] = { email, password: 'hashed-pw' };
        }

        const req = makeRequest({ email });
        const res = await forgotPasswordPOST(req);

        // Status must always be 200
        expect(res.status).toBe(200);

        // Body must always have the same shape and message
        const body = await res.json();
        expect(Object.keys(body)).toEqual(['message']);
        expect(body.message).toBe(
          "If an account with that email exists, we've sent a password reset link.",
        );
      }),
      { numRuns: 20 },
    );
  });
});
