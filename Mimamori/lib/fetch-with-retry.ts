/**
 * Client-side fetch wrapper with configurable retry for 5xx and network errors.
 *
 * - Retries on 5xx status codes and network errors (fetch throws)
 * - Does NOT retry on 4xx client errors by default
 * - Default: maxRetries=2, delayMs=2000
 *
 * Requirements: 24.1, 24.3
 */

export interface RetryConfig {
  maxRetries: number;   // default 2
  delayMs: number;      // default 2000
  retryOn4xx: boolean;  // default false
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 2,
  delayMs: 2000,
  retryOn4xx: false,
};

/**
 * Fetch with automatic retry on transient failures.
 *
 * @param url     - Request URL
 * @param options - Standard RequestInit options
 * @param config  - Partial retry configuration (merged with defaults)
 * @param delayFn - Sleep function (injectable for testing)
 * @returns The final Response
 * @throws The last network error if all retries are exhausted without a response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config?: Partial<RetryConfig>,
  delayFn: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Response> {
  const { maxRetries, delayMs, retryOn4xx } = { ...DEFAULT_CONFIG, ...config };
  const totalAttempts = maxRetries + 1;

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const response = await fetch(url, options);

      // 4xx — return immediately unless retryOn4xx is enabled
      if (response.status >= 400 && response.status < 500) {
        if (!retryOn4xx) {
          return response;
        }
        // retryOn4xx enabled — retry if attempts remain
        lastResponse = response;
        if (attempt < totalAttempts - 1) {
          await delayFn(delayMs);
          continue;
        }
        return response;
      }

      // 5xx — retry if attempts remain
      if (response.status >= 500) {
        lastResponse = response;
        if (attempt < totalAttempts - 1) {
          await delayFn(delayMs);
          continue;
        }
        return response;
      }

      // Success (1xx, 2xx, 3xx)
      return response;
    } catch (error: unknown) {
      // Network error — retry if attempts remain
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < totalAttempts - 1) {
        await delayFn(delayMs);
        continue;
      }
    }
  }

  // All retries exhausted — throw last network error or return last 5xx response
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError ?? new Error('fetchWithRetry: all attempts failed');
}
