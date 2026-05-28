import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/gemini-client';
import { renderPrompt, PromptType } from '@/lib/ai/prompt-templates';
import { requireAuth } from '@/lib/auth/middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { sanitizeForPrompt } from '@/lib/ai/input-sanitizer';
import { validateProbeResponse, validateVisitPrepResponse, validateFollowupProbeResponse } from '@/lib/ai/validate-schema';
import { callWithCircuitBreaker } from '@/lib/circuit-breaker';

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }
  const userEmail = authResult.user.sub;

  // --- Rate limiting: 10 req/min per user ---
  const rateCheck = checkRateLimit(`medical-reasoning:${userEmail}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { logs, documents, promptType, conditions, allergies, extraContext, customNotes } = body;

    // --- Request validation ---
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { error: 'Missing required field: logs' },
        { status: 400 },
      );
    }

    // --- Map incoming promptType ---
    const resolvedType: PromptType =
      promptType === 'visit-prep'
        ? 'visit-prep'
        : promptType === 'generate-probes'
          ? 'generate-probes'
          : promptType === 'generate-followup-probes'
            ? 'generate-followup-probes'
            : promptType === 'generate-recommendation'
              ? 'generate-recommendation'
              : promptType === 'export-summary'
                ? 'export-summary'
                : 'default-analysis';

    // --- Sanitize user log text ---
    const sanitizedLogs = logs.map((log: any) => {
      if (typeof log === 'string') {
        return sanitizeForPrompt(log).text;
      }
      if (log && typeof log === 'object' && typeof log.text === 'string') {
        return { ...log, text: sanitizeForPrompt(log.text).text };
      }
      return log;
    });

    // --- Build prompt with patient context ---
    const notesContext = Array.isArray(customNotes) && customNotes.length > 0
      ? `\n\nPatient's custom notes/symptoms:\n${customNotes.map((n: string) => `- ${n}`).join('\n')}`
      : '';

    const promptText = renderPrompt(resolvedType, {
      logs: sanitizedLogs,
      documents: documents || [],
      conditions: conditions || [],
      allergies: allergies || [],
      extraContext: (extraContext || '') + notesContext,
    });

    // --- Wrap Gemini call with circuit breaker ---
    const responseText = await callWithCircuitBreaker('gemini', () =>
      generateText(promptText, 'orchestrator'),
    );

    const insightText = responseText || 'AI insight connected successfully.';

    // --- Validate AI response based on prompt type ---
    if (resolvedType === 'generate-probes' || resolvedType === 'generate-followup-probes') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(insightText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
      } catch {
        return NextResponse.json(
          { error: 'AI response format invalid' },
          { status: 502 },
        );
      }
      // Follow-up probes can return an empty array (no follow-ups needed)
      if (resolvedType === 'generate-followup-probes' && Array.isArray(parsed) && parsed.length === 0) {
        return NextResponse.json({ insight: '[]', probes: [] });
      }
      const validation = resolvedType === 'generate-followup-probes'
        ? validateFollowupProbeResponse(parsed)
        : validateProbeResponse(parsed);
      if (!validation.valid) {
        // For follow-ups, treat invalid response as "no follow-ups needed"
        if (resolvedType === 'generate-followup-probes') {
          return NextResponse.json({ insight: '[]', probes: [] });
        }
        return NextResponse.json(
          { error: 'AI response format invalid' },
          { status: 502 },
        );
      }
      return NextResponse.json({ insight: insightText, probes: validation.data });
    }

    if (resolvedType === 'visit-prep') {
      const validation = validateVisitPrepResponse(insightText);
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'AI response format invalid' },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ insight: insightText });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && ('message' in error || 'name' in error)) {
      const err = error as { name?: string; message?: string };
      
      // Handle circuit breaker open
      if (err.message && err.message.includes('Circuit breaker is open')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 },
        );
      }

      // Handle Gemini API Key issues / auth issues
      if (
        err.name === 'APIKeyError' || 
        (err.message && (err.message.includes('API key') || err.message.includes('invalid key')))
      ) {
        return NextResponse.json(
          { error: 'AI service is not configured. Please set up GEMINI_API_KEY.', insight: null },
          { status: 503 },
        );
      }
    }

    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Unknown error';
    console.error('Error invoking Gemini reasoning route:', msg);
    return NextResponse.json(
      { error: 'Failed to generate AI content. Please try again later.', details: msg },
      { status: 500 },
    );
  }
}
