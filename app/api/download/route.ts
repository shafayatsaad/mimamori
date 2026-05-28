import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let key = '';
  if (url.startsWith('s3://')) {
     const s3Parts = url.replace('s3://', '').split('/');
     s3Parts.shift(); // Remove bucket part
     key = s3Parts.join('/');
  } else if (url.startsWith('supabase://')) {
     key = url.replace('supabase://', '');
  } else {
     return NextResponse.json({ error: 'Invalid storage URL format' }, { status: 400 });
  }

  try {
     const { data, error } = await supabase.storage
       .from('documents')
       .createSignedUrl(decodeURIComponent(key), 3600);

     if (error || !data?.signedUrl) {
       throw error || new Error('Failed to generate signed URL from storage provider');
     }

     return NextResponse.redirect(data.signedUrl);
  } catch (e: unknown) {
     console.error('Download presign error:', e);
     const msg = e && typeof e === 'object' && 'message' in e ? String((e as {message?: string}).message) : 'Unknown error';
     return NextResponse.json({ error: 'Failed to generate signed URL', details: msg }, { status: 500 });
  }
}
