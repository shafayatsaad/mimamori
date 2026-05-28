import { NextResponse } from 'next/server';
import { medicalAi } from '@/lib/medical-ai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const entities = await medicalAi.analyze(text);

    return NextResponse.json({ entities });
  } catch (error) {
    console.error('Error analyzing medical text:', error);
    return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
  }
}
