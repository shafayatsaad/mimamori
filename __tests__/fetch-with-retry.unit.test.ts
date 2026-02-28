import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithRetry, RetryConfig } from '../lib/fetch-with-retry';

// Instant delay for tests
const noDelay = async (_ms: number) => {};

function mockResponse(status: number): Response {
  return new Response(null, { status });
}

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns immediately on 2xx success without retrying', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(200));

    const res = await fetchWithRetry('/api/test', {}, undefined, noDelay);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns 4xx immediately without retrying (retryOn4xx=false)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(404));

    const res = await fetchWithRetry('/api/test', {}, undefined, noDelay);

    expect(res.status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx and returns last response after exhausting retries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(503));

    const res = await fetchWithRetry('/api/test', {}, { maxRetries: 2 }, noDelay);

    expect(res.status).toBe(503);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('retries on 5xx and succeeds on a later attempt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry('/api/test', {}, { maxRetries: 2 }, noDelay);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retries on network errors and throws after exhausting retries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network failure'));

    await expect(
      fetchWithRetry('/api/test', {}, { maxRetries: 1 }, noDelay),
    ).rejects.toThrow('Network failure');

    expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  it('retries on network error then succeeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry('/api/test', {}, { maxRetries: 2 }, noDelay);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses default config (maxRetries=2, delayMs=2000)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(502));
    const delaySpy = vi.fn(noDelay);

    const res = await fetchWithRetry('/api/test', {}, undefined, delaySpy);

    expect(res.status).toBe(502);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(delaySpy).toHaveBeenCalledTimes(2);
    expect(delaySpy).toHaveBeenCalledWith(2000);
  });

  it('retries 4xx when retryOn4xx is true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockResponse(429))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry('/api/test', {}, { retryOn4xx: true }, noDelay);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400 (client error)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(400));

    const res = await fetchWithRetry('/api/test', {}, undefined, noDelay);

    expect(res.status).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401 (unauthorized)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(401));

    const res = await fetchWithRetry('/api/test', {}, undefined, noDelay);

    expect(res.status).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('handles mixed 5xx then network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockResponse(500))
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockResolvedValueOnce(mockResponse(200));

    const res = await fetchWithRetry('/api/test', {}, { maxRetries: 2 }, noDelay);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('returns 5xx response when network error followed by 5xx exhausts retries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse(500));

    const res = await fetchWithRetry('/api/test', {}, { maxRetries: 1 }, noDelay);

    expect(res.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
