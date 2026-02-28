import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getSessionCookieOptions } from '@/lib/auth/session';

/**
 * GET /api/auth/me
 *
 * Returns the current user's session info by verifying the httpOnly session
 * cookie. Used by AppContext on mount to restore authentication state without
 * storing it in localStorage (Requirement 3.5).
 */
export async function GET(request: NextRequest) {
  const cookieName = getSessionCookieOptions().name;
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      email: session.sub,
      name: session.name,
      role: session.role,
    },
  });
}
