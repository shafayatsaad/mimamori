import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, getSessionCookieOptions } from '@/lib/auth/session';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch user from Supabase
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('Login database fetch error:', fetchError);
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    if (!user) {
      // Generic error — don't reveal whether email exists
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify password against stored bcrypt hash
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      // Generic error — don't reveal whether email or password was wrong
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Issue JWT via Session_Manager
    const token = await createSession({
      sub: user.email,
      name: user.name,
      role: user.role,
    });

    // Build response with user info (token goes in cookie only, not response body)
    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, { status: 200 });

    // Set httpOnly session cookie
    const cookieOptions = getSessionCookieOptions();
    response.cookies.set(cookieOptions.name, token, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: `Internal server error: ${getErrorMessage(error)}` }, { status: 500 });
  }
}
