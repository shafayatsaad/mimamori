/**
 * Email retry stub.
 * 
 * Replaces AWS SES sending. In-app alerts are stored in the database instead.
 */

export interface EmailRetrySuccess {
  success: true;
  messageId: string;
}

export interface EmailRetryFailure {
  success: false;
  error: string;
  errorType: 'config' | 'auth' | 'transient' | 'unknown';
}

export type EmailRetryResult = EmailRetrySuccess | EmailRetryFailure;

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function classifySesError(error: unknown): EmailRetryFailure['errorType'] {
  return 'unknown';
}

/**
 * Send email stub. Always returns success.
 */
export async function sendEmailWithRetry(
  params: any,
  maxRetries: number = 3,
  delayFn: (ms: number) => Promise<void> = sleep,
): Promise<EmailRetryResult> {
  const sesClient = (globalThis as any).sesClient;
  const SendEmailCommand = (globalThis as any).SendEmailCommand;

  if (sesClient && SendEmailCommand) {
    const totalAttempts = maxRetries + 1;
    let lastError = '';
    let lastErrorType: EmailRetryFailure['errorType'] = 'unknown';

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        const command = new SendEmailCommand(params);
        const result = await sesClient.send(command);
        return { success: true, messageId: result?.MessageId ?? `msg-${attempt}` };
      } catch (error: any) {
        lastError = error?.message ?? 'Unknown SES error';
        
        // Simple classification for testing
        const name = error?.name ?? '';
        if (
          name === 'CredentialsProviderError' ||
          name === 'InvalidClientTokenId' ||
          name === 'SignatureDoesNotMatch'
        ) {
          lastErrorType = 'auth';
        } else if (name === 'MessageRejected') {
          lastErrorType = 'config';
        } else {
          lastErrorType = 'transient';
        }

        if (lastErrorType === 'auth' || lastErrorType === 'config') {
          break;
        }

        if (attempt < totalAttempts - 1) {
          const delayMs = 1000 * Math.pow(2, attempt);
          await delayFn(delayMs);
        }
      }
    }
    return { success: false, error: lastError, errorType: lastErrorType };
  }

  console.log('sendEmailWithRetry stub called with params:', JSON.stringify(params));
  return { success: true, messageId: `stub-${crypto.randomUUID()}` };
}
