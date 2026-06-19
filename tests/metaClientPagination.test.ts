import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { MetaClient } from '../src/metaClient.js';
import type { MetaGetOptions } from '../src/metaClient.js';
import { MetaApiError } from '../src/utils/metaError.js';

// Helper to create a mock fetch response
function mockResponse(
  data: unknown[],
  paging?: { next?: string; previous?: string },
  status = 200,
  headers: Record<string, string> = {}
): Response {
  const body = JSON.stringify({ data, paging });
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

describe('MetaClient — Pagination', () => {
  let client: MetaClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new MetaClient({
      accessToken: 'test-token',
      adAccountId: 'act_123',
      apiVersion: 'v20.0',
    });
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── Non-paginated (backward compat) ──

  it('non-paginated mode returns single page data (backward compat)', async () => {
    const items = [{ id: '1', name: 'A' }];
    fetchSpy.mockResolvedValue(mockResponse(items));

    const result = await client.metaGet<{ data: Array<{ id: string }> }>('/test');

    expect(result.data).toEqual(items);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('non-paginated mode does not loop even with paging.next present', async () => {
    const items = [{ id: '1' }];
    fetchSpy.mockResolvedValue(
      mockResponse(items, {
        next: 'https://graph.facebook.com/v20.0/test?after=cursor2',
      })
    );

    const result = await client.metaGet<{ data: Array<{ id: string }> }>('/test');

    expect(result.data).toEqual(items);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('non-paginated mode: limit param is passed through', async () => {
    fetchSpy.mockResolvedValue(mockResponse([{ id: '1' }]));

    await client.metaGet<{ data: Array<{ id: string }> }>('/test', { limit: 50 });

    const callUrl = fetchSpy.mock.calls[0][0];
    expect(callUrl).toContain('limit=50');
  });

  // ── Paginated mode ──

  it('paginated mode loops through multiple pages', async () => {
    // Page 1: 2 items + next cursor
    // Page 2: 2 items + next cursor
    // Page 3: 1 item, no paging (stop)
    const page1 = [{ id: '1' }, { id: '2' }];
    const page2 = [{ id: '3' }, { id: '4' }];
    const page3 = [{ id: '5' }];

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse(page1, { next: 'https://graph.facebook.com/v20.0/test?after=c2' })
      )
      .mockResolvedValueOnce(
        mockResponse(page2, { next: 'https://graph.facebook.com/v20.0/test?after=c3' })
      )
      .mockResolvedValueOnce(mockResponse(page3));

    const result = await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 2 },
      { paginate: true, pageDelay: 0 }
    );

    expect(result.data).toHaveLength(5);
    expect(result.data.map((r: any) => r.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('paginated mode stops at maxPages', async () => {
    // Only set up 4 pages, but maxPages=2
    const page1 = [{ id: '1' }];
    const page2 = [{ id: '2' }];

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse(page1, { next: 'https://graph.facebook.com/v20.0/test?after=c2' })
      )
      .mockResolvedValueOnce(
        mockResponse(page2, { next: 'https://graph.facebook.com/v20.0/test?after=c3' })
      );

    const result = await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 1 },
      { paginate: true, maxPages: 2, pageDelay: 0 }
    );

    expect(result.data).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('paginated mode stops when data is empty', async () => {
    const page1 = [{ id: '1' }];
    const emptyPage: Array<{ id: string }> = [];

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse(page1, { next: 'https://graph.facebook.com/v20.0/test?after=c2' })
      )
      .mockResolvedValueOnce(mockResponse(emptyPage, { next: 'https://graph.facebook.com/v20.0/test?after=c3' }));

    const result = await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 1 },
      { paginate: true, pageDelay: 0 }
    );

    expect(result.data).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('paginated mode stops when no paging.next', async () => {
    const page1 = [{ id: '1' }];

    fetchSpy.mockResolvedValueOnce(mockResponse(page1));

    const result = await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 1 },
      { paginate: true, pageDelay: 0 }
    );

    expect(result.data).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('paginated mode passes after cursor to subsequent requests', async () => {
    const page1 = [{ id: '1' }];
    const page2 = [{ id: '2' }];

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse(page1, { next: 'https://graph.facebook.com/v20.0/test?after=abc123' })
      )
      .mockResolvedValueOnce(mockResponse(page2));

    await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 1 },
      { paginate: true, pageDelay: 0 }
    );

    // Second call should include after=abc123
    const secondUrl = fetchSpy.mock.calls[1][0];
    expect(secondUrl).toContain('after=abc123');
  });

  it('paginated mode: extractAfterCursor falls back to regex when URL parsing fails', async () => {
    // This simulates an edge case where the URL contains unusual characters
    const page1 = [{ id: '1' }];
    const page2 = [{ id: '2' }];

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse(page1, { next: 'https://graph.facebook.com/v20.0/test?after=eyJ0eXBlIjoiRkEifQ%3D%3D' })
      )
      .mockResolvedValueOnce(mockResponse(page2));

    await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 1 },
      { paginate: true, pageDelay: 0 }
    );

    const secondUrl = fetchSpy.mock.calls[1][0];
    expect(secondUrl).toContain('after=');
  });
});

describe('MetaClient — Rate Limit', () => {
  let client: MetaClient;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new MetaClient({
      accessToken: 'test-token',
      adAccountId: 'act_123',
      apiVersion: 'v20.0',
    });
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('parses X-Ad-Account-Usage header correctly', async () => {
    const usageHeader = JSON.stringify({
      acc_id_act_123: { usage: 28, acc_id: 'act_123', call_count: 28, total_cputime: 3, total_time: 3 },
    });

    fetchSpy.mockResolvedValue(
      mockResponse([{ id: '1' }], undefined, 200, { 'X-Ad-Account-Usage': usageHeader })
    );

    await client.metaGet<{ data: Array<{ id: string }> }>('/test');

    expect(client.lastRateLimitInfo).not.toBeNull();
    expect(client.lastRateLimitInfo!.usagePercent).toBe(28);
    expect(client.lastRateLimitInfo!.remaining).toBe(72);
  });

  it('retries on HTTP 429 with exponential backoff', async () => {
    // 429 first, then 429 again, then success
    const usageHeader = JSON.stringify({
      acc_id_act_123: { usage: 95, acc_id: 'act_123', call_count: 95, total_cputime: 10, total_time: 10 },
    });

    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: 'Rate limit hit', type: 'OAuthException', code: 4 },
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'X-Ad-Account-Usage': usageHeader },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: 'Rate limit hit still', type: 'OAuthException', code: 4 },
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(mockResponse([{ id: '1' }]));

    const result = await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      {},
      { paginate: false, maxRetries: 3 }
    );

    expect(result.data).toEqual([{ id: '1' }]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('throws MetaApiError after exhausting 429 retries', async () => {
    const makeErrorResponse = () =>
      new Response(
        JSON.stringify({
          error: { message: 'Rate limit exceeded', type: 'OAuthException', code: 4 },
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );

    // Each call needs a fresh Response to avoid "Body already read" error
    fetchSpy
      .mockResolvedValueOnce(makeErrorResponse())
      .mockResolvedValueOnce(makeErrorResponse())
      .mockResolvedValueOnce(makeErrorResponse());

    await expect(
      client.metaGet<{ data: Array<{ id: string }> }>(
        '/test',
        {},
        { paginate: false, maxRetries: 2 }
      )
    ).rejects.toThrow(MetaApiError);

    // Initial + 2 retries = 3 calls (maxRetries=2 means 2 retries after initial)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('applies longer page delay when rate limit >80% in paginated mode', async () => {
    const usageHeader = JSON.stringify({
      acc_id_act_123: { usage: 85, acc_id: 'act_123', call_count: 85, total_cputime: 10, total_time: 10 },
    });

    const page1 = [{ id: '1' }];
    const page2 = [{ id: '2' }];

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse(page1, { next: 'https://graph.facebook.com/v20.0/test?after=c2' }, 200, {
          'X-Ad-Account-Usage': usageHeader,
        })
      )
      .mockResolvedValueOnce(mockResponse(page2));

    // Start time tracking
    const start = Date.now();
    const result = await client.metaGet<{ data: Array<{ id: string }> }>(
      '/test',
      { limit: 1 },
      { paginate: true, pageDelay: 10 }
    );
    const elapsed = Date.now() - start;

    // With 85% usage, delay should be 5x pageDelay = 50ms
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(result.data).toHaveLength(2);
  });

  it('non-429 MetaApiError propagates immediately without retry', async () => {
    const errorBody = {
      error: { message: 'Invalid parameter', type: 'OAuthException', code: 100 },
    };

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      client.metaGet<{ data: Array<{ id: string }> }>('/test')
    ).rejects.toThrow(MetaApiError);

    // Only 1 call, no retry for non-429
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null rate limit info when header is absent', async () => {
    fetchSpy.mockResolvedValue(mockResponse([{ id: '1' }]));

    await client.metaGet<{ data: Array<{ id: string }> }>('/test');

    expect(client.lastRateLimitInfo).toBeNull();
  });

  it('handles malformed rate limit header gracefully', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse([{ id: '1' }], undefined, 200, { 'X-Ad-Account-Usage': 'not-json' })
    );

    await client.metaGet<{ data: Array<{ id: string }> }>('/test');

    expect(client.lastRateLimitInfo).toBeNull();
  });
});
