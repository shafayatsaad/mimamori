import { NextRequest, NextResponse } from "next/server";
import {
  verifySession,
  getSessionCookieOptions,
  type SessionPayload,
} from "./session";

export type { SessionPayload };

/**
 * Validates the session cookie on a protected API route request.
 *
 * Returns the decoded session payload when the JWT is valid, or a 401
 * NextResponse when the cookie is missing, expired, or malformed.
 *
 * Requirements: 27.1, 27.2
 */
export async function requireAuth(
  req: NextRequest,
): Promise<
  | { authenticated: true; user: SessionPayload }
  | { authenticated: false; response: NextResponse }
> {
  const cookieName = getSessionCookieOptions().name;
  const token = req.cookies.get(cookieName)?.value;

  if (!token) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  const session = await verifySession(token);

  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  return { authenticated: true, user: session };
}
