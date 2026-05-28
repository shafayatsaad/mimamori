import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { sendEmailWithRetry } from '@/lib/email-retry';
import { getConfig } from '@/lib/config-service';
import { requireAuth } from '@/lib/auth/middleware';
import { validateSendAlertRequest } from '@/lib/api-validation';

/**
 * Store an in-app notification in Supabase.
 */
async function storeInAppNotification(
  email: string,
  message: string,
  reason: string,
): Promise<boolean> {
  const now = new Date();
  const alertId = crypto.randomUUID();
  const createdAt = now.toISOString();

  try {
    const { error } = await supabase
      .from('alerts')
      .insert({
        id: alertId,
        email,
        type: 'system',
        title: 'System Health Notification',
        message,
        read: false,
        created_at: createdAt,
      });

    if (error) throw error;
    console.log('Stored in-app notification for:', email, '— reason:', reason);
    return true;
  } catch (dbError) {
    console.error('Failed to store in-app notification in Supabase:', dbError);
    return false;
  }
}

export async function POST(req: NextRequest) {
  // --- Auth ---
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  try {
    const body = await req.json();

    // --- Request validation ---
    const validation = validateSendAlertRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { email, message } = body;

    let appConfig;
    try {
      appConfig = getConfig();
    } catch (configError) {
      console.error('Configuration loading error:', configError);
      const stored = await storeInAppNotification(
        email,
        message || 'Health alert (configuration unavailable)',
        'Config error fallback',
      );
      return NextResponse.json({
        success: false,
        type: 'config_error',
        fallback: stored ? 'in_app_notification' : 'none',
        message: 'Alert saved as in-app notification.',
      }, { status: 200 }); // Return success status so client doesn't crash
    }

    const emailContent = message || appConfig.alert.defaultTemplate;
    const emailSubject = appConfig.alert.defaultSubject;

    const params = {
      Destination: { ToAddresses: [email] },
      Message: {
        Body: { Text: { Data: emailContent, Charset: 'UTF-8' } },
        Subject: { Data: emailSubject, Charset: 'UTF-8' },
      },
      Source: 'noreply@mimamori.ai',
    };

    // Storing in-app notification directly as main flow (Option A)
    const stored = await storeInAppNotification(
      email,
      emailContent,
      'Direct in-app notification dispatch',
    );

    // Call stub for email dispatch (compatibility)
    const result = await sendEmailWithRetry(params, 3);

    if (stored && result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    return NextResponse.json({
      success: false,
      type: 'dispatch_failed',
      fallback: stored ? 'in_app_notification' : 'none',
      message: 'Failed to send alert, but saved as in-app notification.',
    }, { status: 500 });

  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string };
    console.error('Send alert error:', errObj?.name, errObj?.message);

    return NextResponse.json({
      error: 'Failed to dispatch alert notification.',
      type: 'transient',
      details: errObj?.message,
    }, { status: 500 });
  }
}
