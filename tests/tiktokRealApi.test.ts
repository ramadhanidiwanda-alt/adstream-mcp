import { describe, expect, it } from 'vitest';
import { TikTokApiClient, TikTokApiError } from '../src/tiktokClient.js';
import { getTikTokReport } from '../src/tools/getTikTokReport.js';
import { getGmvMaxReport } from '../src/tools/getGmvMaxReport.js';
import { getTikTokAdvertisers } from '../src/tools/getTikTokAdvertisers.js';
import { TikTokAdsAdapter } from '../src/providers/tiktok/TikTokAdsAdapter.js';

function createClientStub(responseData: unknown): TikTokApiClient {
  return {
    get: async <T>() => responseData as T,
    post: async <T>() => responseData as T,
  } as unknown as TikTokApiClient;
}

describe('TikTokApiClient', () => {
  it('throws TikTokApiError when API returns non-zero code', async () => {
    const client = new TikTokApiClient({ accessToken: 'test-token' });

    // Mock fetch to return an error response
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        json: async () => ({ code: 40001, message: 'Invalid access token', data: {} }),
      }) as Response;

    try {
      await expect(client.get('/test')).rejects.toThrow(TikTokApiError);
      await expect(client.get('/test')).rejects.toThrow('Invalid access token');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('resolves data when API returns code 0', async () => {
    const client = new TikTokApiClient({ accessToken: 'test-token' });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        json: async () => ({ code: 0, message: 'OK', data: { list: [{ id: '1' }] } }),
      }) as Response;

    try {
      const result = await client.get<{ list: Array<{ id: string }> }>('/advertiser/info/');
      expect(result.list).toHaveLength(1);
      expect(result.list[0].id).toBe('1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('getTikTokReport', () => {
  it('calls the correct endpoint with required params', async () => {
    let capturedPath = '';
    let capturedParams: Record<string, unknown> = {};

    const clientStub = {
      get: async (_path: string, params: Record<string, unknown>) => {
        capturedPath = _path;
        capturedParams = params;
        return { list: [], page_info: { page: 1, page_size: 10, total_number: 0, total_page: 0 } };
      },
    } as unknown as TikTokApiClient;

    await getTikTokReport(clientStub, {
      advertiserId: '123456',
      reportType: 'BASIC',
      dimensions: ['campaign_id'],
      metrics: ['spend', 'impressions'],
      dataLevel: 'AUCTION_CAMPAIGN',
    });

    expect(capturedPath).toBe('/report/integrated/get/');
    expect(capturedParams.report_type).toBe('BASIC');
    expect(capturedParams.advertiser_id).toBe('123456');
    expect(capturedParams.data_level).toBe('AUCTION_CAMPAIGN');
  });
});

describe('getGmvMaxReport', () => {
  it('calls the correct endpoint with required params', async () => {
    let capturedPath = '';
    let capturedParams: Record<string, unknown> = {};

    const clientStub = {
      get: async (_path: string, params: Record<string, unknown>) => {
        capturedPath = _path;
        capturedParams = params;
        return { list: [], page_info: { page: 1, page_size: 10, total_number: 0, total_page: 0 } };
      },
    } as unknown as TikTokApiClient;

    await getGmvMaxReport(clientStub, {
      advertiserId: '123456',
      storeIds: ['store_1'],
      dimensions: ['campaign_id'],
      metrics: ['gmv', 'spend'],
      startDate: '2026-06-01',
      endDate: '2026-06-14',
    });

    expect(capturedPath).toBe('/gmv_max/report/get/');
    expect(capturedParams.advertiser_id).toBe('123456');
    expect(capturedParams.store_ids).toEqual(['store_1']);
    expect(capturedParams.start_date).toBe('2026-06-01');
    expect(capturedParams.end_date).toBe('2026-06-14');
  });
});

describe('getTikTokAdvertisers', () => {
  it('calls advertiser info endpoint', async () => {
    let capturedPath = '';

    const clientStub = {
      get: async (_path: string) => {
        capturedPath = _path;
        return { list: [{ advertiser_id: '123', advertiser_name: 'Test', status: 'ACTIVE' }] };
      },
    } as unknown as TikTokApiClient;

    const result = await getTikTokAdvertisers(clientStub, ['123']);

    expect(capturedPath).toBe('/advertiser/info/');
    expect(result).toHaveLength(1);
    expect(result[0].advertiser_id).toBe('123');
  });
});

describe('TikTokAdsAdapter with real client', () => {
  it('uses real API client for listAccounts', async () => {
    const clientStub = {
      get: async () => ({ list: [{ advertiser_id: '123', advertiser_name: 'Test', status: 'ACTIVE' }] }),
    } as unknown as TikTokApiClient;

    const adapter = new TikTokAdsAdapter({ client: clientStub });
    const response = await adapter.listAccounts();

    expect(response.ok).toBe(true);
    expect(response.data?.[0]).toMatchObject({ advertiser_id: '123', advertiser_name: 'Test' });
  });

  it('uses real API client for getCampaignPerformance', async () => {
    const clientStub = {
      get: async () => ({
        list: [
          {
            dimensions: { campaign_id: 'cmp_1' },
            metrics: { spend: '100', impressions: '1000', clicks: '50' },
          },
        ],
        page_info: { page: 1, page_size: 10, total_number: 1, total_page: 1 },
      }),
    } as unknown as TikTokApiClient;

    const adapter = new TikTokAdsAdapter({ client: clientStub });
    const response = await adapter.getCampaignPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_1',
      since: '2026-06-01',
      until: '2026-06-14',
      params: {},
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].provider).toBe('tiktok');
    expect(response.data?.[0].delivery.spend).toBe(100);
  });

  it('mock data still works (backward compat)', async () => {
    const adapter = new TikTokAdsAdapter({
      mockData: {
        campaigns: [
          { campaign_id: 'cmp_1', campaign_name: 'Test', spend: '50', impressions: '500', clicks: '25' },
        ],
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_1',
      since: '2026-06-01',
      until: '2026-06-14',
      params: {},
      credentials: { provider: 'tiktok', accessToken: 'secret', accountId: 'advertiser_1', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].delivery.spend).toBe(50);
  });

  it('returns NOT_IMPLEMENTED when neither client nor mock data', async () => {
    const adapter = new TikTokAdsAdapter();

    const response = await adapter.getCampaignPerformance({
      provider: 'tiktok',
      params: {},
    });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });
});
