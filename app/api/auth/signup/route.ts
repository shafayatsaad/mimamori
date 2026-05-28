import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { hashPassword } from '@/lib/auth/password';

function getErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  return 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking user existence:', checkError);
    }

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = {
      email,
      name,
      password: hashedPassword,
      role: role || 'patient',
      createdAt: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert(newUser);

    if (insertError) {
      console.error('Error inserting user:', insertError);
      return NextResponse.json(
        { error: `Database error during signup: ${insertError.message}` },
        { status: 503 }
      );
    }

    return NextResponse.json({ message: 'User created successfully', user: { email: newUser.email, name: newUser.name, role: newUser.role } }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: `Internal server error: ${getErrorMessage(error)}` }, { status: 500 });
  }
}
