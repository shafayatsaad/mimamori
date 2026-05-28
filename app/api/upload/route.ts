import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
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

    const config = getConfig();
    const bucketName = config.supabase.storageBucket || 'documents';

    const buffer = Buffer.from(await file.arrayBuffer());
    const prefix = userId ? `user/${userId.replace(/[^a-zA-Z0-9@_.-]/g, '_')}/` : 'public/';
    const key = `${prefix}${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(key, buffer, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Storage service is temporarily unavailable. Your file was not uploaded — please try again later.' },
        { status: 503 },
      );
    }

    const fileUrl = `supabase://${key}`;

    return NextResponse.json({ fileUrl, key });
  } catch (error: unknown) {
    console.error('Error proxying Supabase upload:', error);
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again or contact support if the problem persists.' },
      { status: 500 },
    );
  }
}
