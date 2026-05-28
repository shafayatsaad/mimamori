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
  console.log('sendEmailWithRetry stub called with params:', JSON.stringify(params));
  return { success: true, messageId: `stub-${crypto.randomUUID()}` };
}
