import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '@/lib/aws-clients';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url || !url.startsWith('s3://')) return NextResponse.json({ error: 'Invalid s3 url' }, { status: 400 });
  
  const s3Parts = url.replace('s3://', '').split('/');
  const bucket = s3Parts.shift()!;
  const key = s3Parts.join('/');
  
  const command = new GetObjectCommand({ Bucket: bucket, Key: decodeURIComponent(key) });
  try {
     const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
     return NextResponse.redirect(signedUrl);
  } catch (e: unknown) {
     console.error('Download presign error', e);
     const msg = e && typeof e === 'object' && 'message' in e ? String((e as {message?: string}).message) : 'Unknown error';
     return NextResponse.json({ error: 'Failed to generate signed URL', details: msg }, { status: 500 });
  }
}
