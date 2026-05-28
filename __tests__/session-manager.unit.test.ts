// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSession,
  createSessionWithExpiry,
  verifySession,
  getSessionCookieOptions,
  clearSession,
} from "@/lib/auth/session";

// Provide required AWS env vars so getConfig() doesn't throw
beforeEach(() => {
  vi.stubEnv("APP_S3_BUCKET_NAME", "test-bucket");
  vi.stubEnv("APP_SES_FROM_EMAIL", "test@example.com");
  vi.stubEnv("APP_BEDROCK_ROUTER_ARN", "arn:aws:bedrock:us-west-2:000000000000:router/test");
  vi.stubEnv("MIMAMORI_USERS_TABLE", "TestUsers");
  vi.stubEnv("MIMAMORI_DATA_TABLE", "TestData");
  vi.stubEnv("SESSION_JWT_SECRET", "test-secret-key-for-unit-tests");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const samplePayload = { sub: "user@example.com", name: "Test User", role: "patient" };

describe("Session_Manager", () => {
  describe("createSession", () => {
    it("returns a JWT string with three dot-separated parts", async () => {
      const token = await createSession(samplePayload);
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    it("creates a token that can be verified", async () => {
      const token = await createSession(samplePayload);
      const result = await verifySession(token);
      expect(result).not.toBeNull();
      expect(result!.sub).toBe(samplePayload.sub);
      expect(result!.name).toBe(samplePayload.name);
      expect(result!.role).toBe(samplePayload.role);
    });
  });

  describe("createSessionWithExpiry", () => {
    it("encodes exp = iat + expirySeconds", async () => {
      const expirySeconds = 3600;
      const token = await createSessionWithExpiry(samplePayload, expirySeconds);
      const result = await verifySession(token);
      expect(result).not.toBeNull();
      expect(result!.exp).toBe(result!.iat + expirySeconds);
    });
  });

  describe("verifySession", () => {
    it("returns null for an invalid token", async () => {
      const result = await verifySession("not.a.valid.token");
      expect(result).toBeNull();
    });

    it("returns null for an expired token", async () => {
      // Create a token that expired 10 seconds ago
      const token = await createSessionWithExpiry(samplePayload, -10);
      const result = await verifySession(token);
      expect(result).toBeNull();
    });

    it("returns null for a tampered token", async () => {
      const token = await createSession(samplePayload);
      // Tamper with the payload section
      const parts = token.split(".");
      parts[1] = parts[1] + "tampered";
      const tampered = parts.join(".");
      const result = await verifySession(tampered);
      expect(result).toBeNull();
    });

    it("returns the full SessionPayload with iat and exp", async () => {
      const token = await createSession(samplePayload);
      const result = await verifySession(token);
      expect(result).not.toBeNull();
      expect(typeof result!.iat).toBe("number");
      expect(typeof result!.exp).toBe("number");
      expect(result!.exp).toBeGreaterThan(result!.iat);
    });
  });

  describe("getSessionCookieOptions", () => {
    it("returns httpOnly=true", () => {
      const opts = getSessionCookieOptions();
      expect(opts.httpOnly).toBe(true);
    });

    it("returns secure=true", () => {
      const opts = getSessionCookieOptions();
      expect(opts.secure).toBe(true);
    });

    it("returns sameSite='strict'", () => {
      const opts = getSessionCookieOptions();
      expect(opts.sameSite).toBe("strict");
    });

    it("returns path='/'", () => {
      const opts = getSessionCookieOptions();
      expect(opts.path).toBe("/");
    });

    it("returns maxAge matching config expirySeconds", () => {
      vi.stubEnv("SESSION_EXPIRY_SECONDS", "7200");
      const opts = getSessionCookieOptions();
      expect(opts.maxAge).toBe(7200);
    });

    it("returns default maxAge of 86400 when no env var set", () => {
      const opts = getSessionCookieOptions();
      expect(opts.maxAge).toBe(86400);
    });
  });

  describe("clearSession", () => {
    it("sets the session cookie with maxAge=0", () => {
      // Create a minimal mock of NextResponse with cookies
      const setCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
      const mockResponse = {
        cookies: {
          set(name: string, value: string, options: Record<string, unknown>) {
            setCalls.push({ name, value, options });
          },
        },
      } as unknown as import("next/server").NextResponse;

      const result = clearSession(mockResponse);
      expect(result).toBe(mockResponse);
      expect(setCalls).toHaveLength(1);
      expect(setCalls[0].name).toBe("mimamori_session");
      expect(setCalls[0].value).toBe("");
      expect(setCalls[0].options.maxAge).toBe(0);
      expect(setCalls[0].options.httpOnly).toBe(true);
      expect(setCalls[0].options.secure).toBe(true);
      expect(setCalls[0].options.sameSite).toBe("strict");
    });
  });
});
