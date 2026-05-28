import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/gemini-client';

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

    const refinedTextResponse = await generateText(promptText, 'orchestrator');
    const refinedText = refinedTextResponse?.trim() || text;

    return NextResponse.json({ refinedText });
  } catch (error) {
    console.error('Error in refine-text route using Gemini:', error);
    return NextResponse.json({ refinedText: 'Error refining text' });
  }
}
