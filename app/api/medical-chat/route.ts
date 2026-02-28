import { NextRequest, NextResponse } from 'next/server';
import { medicalAi } from '@/lib/medical-ai';
import { requireAuth } from '@/lib/auth/middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { sanitizeForPrompt } from '@/lib/ai/input-sanitizer';

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }
  const userEmail = authResult.user.sub;

  // --- Rate limiting: 20 req/min per user ---
  const rateCheck = checkRateLimit(`medical-chat:${userEmail}`, {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 },
    );
  }

  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // --- Sanitize user message text ---
    const sanitizedMessage = sanitizeForPrompt(message).text;

    const prompt = `You are Mimamori's medical AI assistant. Help the patient understand their health data. 
    History: ${JSON.stringify(history || [])}
    Current Question: ${sanitizedMessage}`;

    const reply = await medicalAi.reason(prompt);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Medical Chat Error:', error);
    return NextResponse.json({ error: 'Failed to generate medical AI response' }, { status: 500 });
  }
}
