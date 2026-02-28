import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/lib/aws-clients';
import { getConfig } from '@/lib/config-service';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    let BUCKET_NAME: string;
    try {
      BUCKET_NAME = getConfig().aws.s3BucketName;
    } catch {
      console.error('S3 bucket name not configured (APP_S3_BUCKET_NAME)');
      return NextResponse.json(
        { error: 'Storage service is not configured. Please contact your administrator.' },
        { status: 503 },
      );
    }

    if (!BUCKET_NAME) {
      console.error('S3 bucket name is empty');
      return NextResponse.json(
        { error: 'Storage service is not configured. Please contact your administrator.' },
        { status: 503 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const prefix = userId ? `user/${userId.replace(/[^a-zA-Z0-9@_.-]/g, '_')}/` : 'public/';
    const key = `${prefix}${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));

    const fileUrl = `s3://${BUCKET_NAME}/${key}`;

    return NextResponse.json({ fileUrl, key });
  } catch (error: unknown) {
    console.error('Error proxying S3 upload:', error);

    // Detect S3 / AWS credential issues and return a user-friendly 503
    const errName = (error as { name?: string })?.name ?? '';
    const errMessage = (error as { message?: string })?.message ?? '';

    if (
      errName === 'NoSuchBucket' ||
      errName === 'CredentialsProviderError' ||
      errName === 'InvalidAccessKeyId' ||
      errName === 'SignatureDoesNotMatch' ||
      errName === 'AccessDenied' ||
      errMessage.includes('Could not load credentials') ||
      errMessage.includes('Missing credentials') ||
      errMessage.includes('The specified bucket does not exist')
    ) {
      return NextResponse.json(
        { error: 'Storage service is temporarily unavailable. Your file was not uploaded — please try again later.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload file. Please try again or contact support if the problem persists.' },
      { status: 500 },
    );
  }
}
