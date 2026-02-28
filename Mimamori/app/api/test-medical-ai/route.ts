import { NextResponse } from 'next/server';
import { 
  s3Client, 
  sesClient, 
  bedrockClient, 
  docClient, 
  comprehendMedicalClient, 
  textractClient 
} from '@/lib/aws-clients';
import { getConfig } from '@/lib/config-service';
import { medicalAi } from '@/lib/medical-ai';

export async function GET() {
  try {
    const appConfig = getConfig();
    const tests = {
      config: appConfig,
      s3: !!s3Client,
      ses: !!sesClient,
      bedrock: !!bedrockClient,
      dynamodb: !!docClient,
      comprehendMedical: !!comprehendMedicalClient,
      textract: !!textractClient,
      medicalAi: !!medicalAi,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        region: appConfig.aws.region,
        S3_BUCKET: appConfig.aws.s3BucketName ? 'SET' : 'MISSING',
        DYNAMO_TABLE: appConfig.aws.dataTable ? 'SET' : 'MISSING'
      }
    };

    return NextResponse.json({ 
      success: true, 
      message: 'Mimamori Medical AI Services initialized!',
      tests 
    });

  } catch (error: any) {
    console.error('Medical AI Configuration test failed:', error);
    return NextResponse.json({ 
      error: 'Medical AI Configuration test failed',
      details: error.message 
    }, { status: 500 });
  }
}
