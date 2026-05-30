import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { getConfig } from "../config-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionPayload {
  sub: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME = "mimamori_session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSecretKey(): Uint8Array {
  const { jwtSecret } = getConfig().session;
  return new TextEncoder().encode(jwtSecret);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a signed JWT for the given user payload using the configured expiry
 * from Config_Service.
 */
export async function createSession(payload: {
  sub: string;
  name: string;
  role: string;
}): Promise<string> {
  const { expirySeconds } = getConfig().session;
  return createSessionWithExpiry(payload, expirySeconds);
}

/**
 * Create a signed JWT with a custom expiry duration (in seconds).
 * Exported for testing so property tests can create tokens with custom expiry.
 */
export async function createSessionWithExpiry(
  payload: { sub: string; name: string; role: string },
  expirySeconds: number,
): Promise<string> {
  const secret = getSecretKey();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: payload.sub,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expirySeconds)
    .sign(secret);
}

/**
 * Verify and decode a JWT token. Returns the session payload if valid,
 * or null if the token is expired or invalid.
 */
export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);

    return {
      sub: payload.sub as string,
      name: payload.name as string,
      role: payload.role as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/**
 * Returns cookie options for the session cookie.
 * httpOnly=true, secure=true, sameSite='strict', path='/', maxAge from config.
 */
export function getSessionCookieOptions(): {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
} {
  const { expirySeconds } = getConfig().session;
  const isProd = process.env.NODE_ENV === 'production';
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: expirySeconds,
  };
}

/**
 * Clears the session cookie on the given NextResponse by setting it to an
 * empty value with an immediate expiry.
 */
export function clearSession(response: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
