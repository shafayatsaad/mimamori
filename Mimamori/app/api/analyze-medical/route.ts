import { NextResponse } from 'next/server';
import { DetectEntitiesV2Command } from '@aws-sdk/client-comprehendmedical';
import { comprehendMedicalClient } from '@/lib/aws-clients';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const command = new DetectEntitiesV2Command({
      Text: text
    });

    const response = await comprehendMedicalClient.send(command);

    return NextResponse.json({ entities: response.Entities || [] });
  } catch (error) {
    console.error('Error analyzing medical text:', error);
    return NextResponse.json({ error: 'Failed to analyze text' }, { status: 500 });
  }
}
