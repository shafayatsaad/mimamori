import { NextRequest, NextResponse } from 'next/server';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '@/lib/aws-clients';
import { getModelId } from '@/lib/ai/model-registry';
import { renderPrompt, PromptType } from '@/lib/ai/prompt-templates';
import { requireAuth } from '@/lib/auth/middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { sanitizeForPrompt } from '@/lib/ai/input-sanitizer';
import { validateProbeResponse, validatePersonalizedProbeResponse, validateVisitPrepResponse, validateFollowupProbeResponse } from '@/lib/ai/validate-schema';
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
          : promptType === 'generate-personalized-probes'
            ? 'generate-personalized-probes'
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

    const modelId = getModelId('orchestrator');

    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: promptText }],
        },
      ],
      inferenceConfig: {
        maxTokens: resolvedType === 'export-summary' ? 1500 : 500,
      },
    });

    // --- Wrap Bedrock call with circuit breaker ---
    const response = await callWithCircuitBreaker('bedrock', () =>
      bedrockClient.send(command),
    );

    const insightText =
      response.output?.message?.content?.[0]?.text ||
      'AI insight connected successfully.';

    // --- Validate AI response based on prompt type ---
    if (resolvedType === 'generate-probes' || resolvedType === 'generate-personalized-probes' || resolvedType === 'generate-followup-probes') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(insightText);
      } catch {
        return NextResponse.json(
          { error: 'AI response format invalid' },
          { status: 502 },
        );
      }
      // Follow-up and personalized probes can return an empty array
      if ((resolvedType === 'generate-followup-probes' || resolvedType === 'generate-personalized-probes') && Array.isArray(parsed) && parsed.length === 0) {
        return NextResponse.json({ insight: '[]', probes: [] });
      }
      const validation = resolvedType === 'generate-followup-probes'
        ? validateFollowupProbeResponse(parsed)
        : resolvedType === 'generate-personalized-probes'
          ? validatePersonalizedProbeResponse(parsed)
          : validateProbeResponse(parsed);
      if (!validation.valid) {
        // For follow-ups and personalized, treat invalid response as "none available"
        if (resolvedType === 'generate-followup-probes' || resolvedType === 'generate-personalized-probes') {
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
    // --- Handle Bedrock timeout ---
    if (
      error &&
      typeof error === 'object' &&
      ('name' in error || 'message' in error)
    ) {
      const err = error as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
      const isTimeout =
        err.name === 'TimeoutError' ||
        err.name === 'RequestTimeoutError' ||
        (err.message && err.message.includes('timed out')) ||
        (err.message && err.message.includes('timeout')) ||
        (err.$metadata?.httpStatusCode === 408);

      if (isTimeout) {
        return NextResponse.json(
          { error: 'AI service timed out. Please try again.' },
          { status: 504 },
        );
      }

      // --- Handle circuit breaker open ---
      if (err.message && err.message.includes('Circuit breaker is open')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again later.' },
          { status: 503 },
        );
      }

      // --- Handle missing credentials ---
      const errName = err.name || '';
      const errMsg = err.message || '';

      if (
        errName === 'CredentialsProviderError' ||
        errName === 'CredentialProviderError' ||
        errMsg.includes('Could not load credentials') ||
        errMsg.includes('Missing credentials') ||
        errMsg.includes('credential')
      ) {
        console.error('Bedrock credentials not configured:', errMsg);
        return NextResponse.json(
          { error: 'AI service is not configured. Please set up AWS credentials.', insight: null },
          { status: 503 },
        );
      }

      // --- Handle access denied / model not enabled ---
      if (
        errName === 'AccessDeniedException' ||
        errName === 'UnrecognizedClientException' ||
        errMsg.includes('Access denied') ||
        errMsg.includes('not authorized') ||
        errMsg.includes('is not authorized to perform')
      ) {
        console.error('Bedrock access denied:', errMsg);
        return NextResponse.json(
          { error: 'AI model access not enabled. Please enable model access in AWS Bedrock console.', insight: null },
          { status: 503 },
        );
      }

      // --- Handle invalid model ---
      if (
        errName === 'ValidationException' ||
        errMsg.includes('model identifier is invalid') ||
        errMsg.includes('Could not resolve the foundation model')
      ) {
        console.error('Bedrock model not found:', errMsg);
        return NextResponse.json(
          { error: 'AI model not available. Please check model configuration.', insight: null },
          { status: 503 },
        );
      }
    }

    const msg =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Unknown error';
    console.error('Error invoking Bedrock route:', msg);
    return NextResponse.json(
      { error: 'Failed to generate AI content. Please try again later.', details: msg },
      { status: 500 },
    );
  }
}
