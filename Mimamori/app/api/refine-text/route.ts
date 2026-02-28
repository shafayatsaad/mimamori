import { NextRequest, NextResponse } from 'next/server';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockClient } from '@/lib/aws-clients';
import { getConfig } from '@/lib/config-service';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const promptText = `You are Mimamori's AI text refinement engine. Refine the patient's health log entry following these STRICT rules:

1. REMOVE all filler words (um, uh, like, you know, basically, actually, I mean, so, well, just, kind of, sort of)
2. FIX all grammar errors, spelling mistakes, and punctuation
3. FORMAT any lists or enumerations as clean bullet points using "•" character
4. ADJUST tone to be clear, concise, and clinically informative while keeping the patient's voice
5. PRESERVE all medical terms, medication names, dosages, symptoms, and measurements EXACTLY
6. If the text mentions multiple symptoms or topics, organize them logically
7. Keep the refined text roughly the same length — do NOT add commentary, explanation, or new information

Return ONLY the refined text with no intro, no outro, no quotes, no markdown formatting.

Original text: ${text}`;

    const appConfig = getConfig();
    const models = [
      'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      appConfig.aws.bedrockRouterArn
    ];

    let response: any = null;
    let lastError: unknown = null;

    for (const modelId of models) {
      try {
        const command = new ConverseCommand({
          modelId,
          messages: [{ role: "user", content: [{ text: promptText }] }],
          inferenceConfig: { maxTokens: 500, temperature: 0.1 }
        });
        response = await bedrockClient.send(command);
        break; // Success
      } catch (err: unknown) {
        lastError = err;
        const msg = err && typeof err === 'object' && 'message' in err ? String((err as {message?: string}).message) : 'Unknown';
        console.warn(`Model ${modelId} failed: ${msg}. Trying fallback...`);
      }
    }

    if (!response) {
      console.error('All Bedrock models failed for refine-text:', lastError);
      return NextResponse.json({ error: 'Error refining text. All Bedrock models failed or are throttled.' }, { status: 500 });
    }

    const refinedText = response.output?.message?.content?.[0]?.text?.trim() || text;

    return NextResponse.json({ refinedText });
  } catch (error) {
    console.error('Error in refine-text route using Bedrock:', error);
    return NextResponse.json({ refinedText: 'Error refining text' });
  }
}
