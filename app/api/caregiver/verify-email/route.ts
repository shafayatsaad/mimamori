import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    console.log(`Caregiver email stub verification successful for ${email}`);
    return NextResponse.json({ success: true, message: `Verification simulated successfully to ${email}` });
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string };
    console.error('Caregiver Email Verification Error:', errObj?.name, errObj?.message);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
