// app/api/test-config/route.js
import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config-service';

export async function GET() {
  try {
    const appConfig = getConfig();
    return NextResponse.json({
      success: true,
      message: 'Configuration test successful - no environment variables needed',
      config: {
        region: appConfig.aws.region,
        bucketName: appConfig.aws.s3BucketName ? 'SET' : 'MISSING',
        fromEmail: appConfig.aws.sesFromEmail ? 'SET' : 'MISSING',
        usersTable: appConfig.aws.usersTable ? 'SET' : 'MISSING',
        dataTable: appConfig.aws.dataTable ? 'SET' : 'MISSING',
        bedrockArn: appConfig.aws.bedrockRouterArn ? 'SET' : 'MISSING'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
