import { NextRequest, NextResponse } from 'next/server';
import { VerifyEmailIdentityCommand } from '@aws-sdk/client-ses';
import { sesClient } from '@/lib/aws-clients';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const command = new VerifyEmailIdentityCommand({ EmailAddress: email });
    await sesClient.send(command);

    console.log(`SES Verification Email sent to ${email}`);
    return NextResponse.json({ success: true, message: `Verification email sent successfully to ${email}` });
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string };
    console.error('SES Verification Error:', errObj?.name, errObj?.message);
    const awsError = errObj?.message || errObj?.name || 'Unknown AWS SES configuration error';
    return NextResponse.json({ error: awsError }, { status: 500 });
  }
}
