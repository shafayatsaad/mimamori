import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithRetry } from '@/lib/email-retry';
import { getConfig } from '@/lib/config-service';
import { requireAuth } from '@/lib/auth/middleware';
import { validateSendAlertRequest } from '@/lib/api-validation';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import docClient from '@/lib/dynamodb';

/**
 * Store an in-app notification in DynamoDB as a fallback when email delivery
 * fails. Returns true if the notification was stored successfully.
 */
async function storeInAppNotification(
  email: string,
  message: string,
  tableName: string,
  reason: string,
): Promise<boolean> {
  const now = new Date();
  const alertId = crypto.randomUUID();
  const createdAt = now.toISOString();

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `USER#${email}`,
          SK: `ALERT#${createdAt}#${alertId}`,
          id: alertId,
          type: 'undelivered-email',
          title: 'Undelivered Email Alert',
          message,
          reason,
          read: false,
          createdAt,
        },
      }),
    );
    console.log('Stored in-app notification for:', email, '— reason:', reason);
    return true;
  } catch (dbError) {
    console.error('Failed to store in-app notification in DynamoDB:', dbError);
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

    // --- Config ---
    let appConfig;
    try {
      appConfig = getConfig();
    } catch (configError) {
      console.error('SES configuration error: missing required environment variables', configError);
      // Fall back to in-app notification when config is broken
      const stored = await storeInAppNotification(
        email,
        message || 'Health alert (email configuration unavailable)',
        process.env.MIMAMORI_DATA_TABLE || 'MimamoriData',
        'SES not configured — missing environment variables',
      );
      return NextResponse.json({
        success: false,
        type: 'config_error',
        fallback: stored ? 'in_app_notification' : 'none',
        message: 'Email service is not configured. ' +
          (stored
            ? 'Alert saved as in-app notification.'
            : 'Alert could not be delivered or stored.'),
      }, { status: 503 });
    }

    const senderEmail = appConfig.aws.sesFromEmail;
    const TABLE_NAME = appConfig.aws.dataTable;

    const emailContent = message || appConfig.alert.defaultTemplate;
    const emailSubject = appConfig.alert.defaultSubject;

    const params = {
      Destination: { ToAddresses: [email] },
      Message: {
        Body: { Text: { Data: emailContent, Charset: 'UTF-8' } },
        Subject: { Data: emailSubject, Charset: 'UTF-8' },
      },
      Source: senderEmail,
    };

    const result = await sendEmailWithRetry(params, 3);

    if (result.success) {
      console.log('SES Email sent successfully:', result.messageId);
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    // --- Email failed — determine error type and fall back ---
    const errorType = result.errorType;
    console.error(`SES Email failed (${errorType}):`, result.error);

    // Build a user-friendly error message based on the error type
    let userMessage: string;
    switch (errorType) {
      case 'auth':
        userMessage =
          'Email service credentials are missing or invalid. Please check AWS SES configuration.';
        break;
      case 'config':
        userMessage =
          'Email service is misconfigured (e.g., sender email not verified). Please check SES settings.';
        break;
      case 'transient':
        userMessage =
          'Email delivery failed after retries due to a temporary issue. Please try again later.';
        break;
      default:
        userMessage = 'Email delivery failed after retries.';
    }

    // Always attempt in-app notification fallback
    const stored = await storeInAppNotification(
      email,
      emailContent,
      TABLE_NAME,
      `SES ${errorType} error: ${result.error}`,
    );

    return NextResponse.json({
      success: false,
      type: `email_failed_${errorType}`,
      fallback: stored ? 'in_app_notification' : 'none',
      message: userMessage + (stored ? ' Alert saved as in-app notification.' : ' Alert could not be stored.'),
    }, { status: errorType === 'auth' || errorType === 'config' ? 503 : 500 });
  } catch (error: unknown) {
    const errObj = error as { name?: string; message?: string };
    console.error('Send alert error:', errObj?.name, errObj?.message);

    return NextResponse.json({
      error: 'Failed to send email. Please try again later.',
      type: 'transient',
      details: errObj?.message,
    }, { status: 500 });
  }
}
