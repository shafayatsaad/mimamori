// app/api/test-bedrock/route.js
import { NextResponse } from 'next/server';
import { MedicalAI } from '@/lib/medical-ai';
import { getConfig } from '@/lib/config-service';

export async function GET() {
  try {
    console.log('Testing Bedrock connection...');
    
    const testResult = await MedicalAI.testConnection();
    
    return NextResponse.json({
      success: true,
      message: 'Bedrock test completed',
      region: getConfig().aws.region,
      testResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bedrock test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      region: getConfig().aws.region
    }, { status: 500 });
  }
}
