/**
 * Email retry utility with exponential backoff.
 *
 * Wraps SES sendEmail with configurable retry logic.
 * Backoff schedule: 1s × 2^attempt (1s, 2s, 4s for retries 0, 1, 2).
 *
 * Requirements: 13.1
 */

import { SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { sesClient } from './aws-clients';

export interface EmailRetrySuccess {
  success: true;
  messageId: string;
}

export interface EmailRetryFailure {
  success: false;
  error: string;
  /** Classifies the failure so callers can decide on fallback strategy. */
  errorType: 'config' | 'auth' | 'transient' | 'unknown';
}

export type EmailRetryResult = EmailRetrySuccess | EmailRetryFailure;

/** Default sleep using setTimeout. Exported so tests can override. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Classify an SES error into a category for better error handling.
 *
 * - `config`: SES is not configured (missing region, sender not verified, etc.)
 * - `auth`: AWS credentials are missing or invalid
 * - `transient`: Temporary failure that may succeed on retry
 * - `unknown`: Unrecognized error
 */
export function classifySesError(error: unknown): EmailRetryFailure['errorType'] {
  const err = error as { name?: string; code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const name = err?.name ?? '';
  const code = err?.code ?? '';
  const message = err?.message ?? '';
  const httpStatus = err?.$metadata?.httpStatusCode;

  // Credential / auth errors — do not retry
  if (
    name === 'CredentialsProviderError' ||
    name === 'InvalidClientTokenId' ||
    name === 'SignatureDoesNotMatch' ||
    name === 'UnrecognizedClientException' ||
    name === 'AccessDeniedException' ||
    code === 'InvalidClientTokenId' ||
    code === 'SignatureDoesNotMatch' ||
    httpStatus === 403
  ) {
    return 'auth';
  }

  // Configuration errors — do not retry
  if (
    name === 'MessageRejected' ||
    name === 'MailFromDomainNotVerifiedException' ||
    name === 'ConfigurationSetDoesNotExist' ||
    code === 'MessageRejected' ||
    message.includes('Email address is not verified') ||
    message.includes('not authorized to send') ||
    message.includes('MAIL FROM domain')
  ) {
    return 'config';
  }

  // Transient / throttle errors — worth retrying
  if (
    name === 'Throttling' ||
    name === 'TooManyRequestsException' ||
    name === 'ServiceUnavailableException' ||
    code === 'Throttling' ||
    httpStatus === 429 ||
    httpStatus === 500 ||
    httpStatus === 503
  ) {
    return 'transient';
  }

  return 'unknown';
}

/**
 * Returns true when the error type is non-retryable (auth or config).
 * Retrying these will always fail, so we should bail out early.
 */
function isNonRetryable(errorType: EmailRetryFailure['errorType']): boolean {
  return errorType === 'auth' || errorType === 'config';
}

/**
 * Send an email via SES with exponential backoff retry.
 *
 * @param params  - SES SendEmailCommandInput
 * @param maxRetries - Number of retries after the initial attempt (default 3)
 * @param delayFn - Sleep function (injectable for testing)
 * @returns EmailRetryResult
 */
export async function sendEmailWithRetry(
  params: SendEmailCommandInput,
  maxRetries: number = 3,
  delayFn: (ms: number) => Promise<void> = sleep,
): Promise<EmailRetryResult> {
  const totalAttempts = maxRetries + 1; // 1 initial + maxRetries retries
  let lastError: string = '';
  let lastErrorType: EmailRetryFailure['errorType'] = 'unknown';

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const command = new SendEmailCommand(params);
      const result = await sesClient.send(command);
      return { success: true, messageId: result.MessageId ?? '' };
    } catch (error: unknown) {
      const errObj = error as { name?: string; message?: string };
      lastError = errObj?.message ?? 'Unknown SES error';
      lastErrorType = classifySesError(error);

      // Non-retryable errors — bail out immediately, no point retrying
      if (isNonRetryable(lastErrorType)) {
        console.error(
          `SES ${lastErrorType} error (non-retryable): ${errObj?.name} — ${lastError}`,
        );
        break;
      }

      // If this wasn't the last attempt, wait with exponential backoff
      if (attempt < totalAttempts - 1) {
        const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, ...
        await delayFn(delayMs);
      }
    }
  }

  return { success: false, error: lastError, errorType: lastErrorType };
}
