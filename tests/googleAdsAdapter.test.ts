import { describe, expect, it } from 'vitest';
import { GoogleAdsAdapter, GoogleAdsRestClient, type GoogleAdsApiClient } from '../src/providers/google/GoogleAdsAdapter.js';

function createClientStub(rows: unknown[] = []): GoogleAdsApiClient & { calls: Array<{ customerId: string; query: string }> } {
  const calls: Array<{ customerId: string; query: string }> = [];
  return {
    calls,
    search: async (customerId: string, query: string) => {
      calls.push({ customerId, query });
      return rows;
    },
    listAccessibleCustomers: async () => [{ resourceName: 'customers/1234567890' }],
  };
}

describe('GoogleAdsAdapter', () => {
  it('implements read-only provider contract shape', () => {
    const adapter = new GoogleAdsAdapter();

    expect(adapter.id).toBe('google');
    expect(adapter.displayName).toBe('Google Ads');
    expect(adapter.capabilities.operations).toEqual(['read']);
    expect(typeof adapter.listAccounts).toBe('function');
    expect(typeof adapter.getCampaignPerformance).toBe('function');
    expect(typeof adapter.getAdsetOrAdgroupPerformance).toBe('function');
    expect(typeof adapter.getAdPerformance).toBe('function');
  });

  it('uses REST SearchStream with Google Ads auth headers', async () => {
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    const client = new GoogleAdsRestClient({
      accessToken: 'access-token',
      developerToken: 'developer-token',
      loginCustomerId: '999',
      baseUrl: 'https://example.test',
      apiVersion: 'v24',
      fetchFn: async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(JSON.stringify([{ results: [{ customer: { id: '123' } }] }]), { status: 200 });
      },
    });

    const rows = await client.search('123', 'SELECT customer.id FROM customer');

    expect(rows).toEqual([{ customer: { id: '123' } }]);
    expect(capturedUrl).toBe('https://example.test/v24/customers/123/googleAds:searchStream');
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.headers).toMatchObject({
      authorization: 'Bearer access-token',
      'developer-token': 'developer-token',
      'login-customer-id': '999',
    });
  });

  it('lists accessible customers through the Google Ads API client', async () => {
    const client = createClientStub();
    const adapter = new GoogleAdsAdapter({ client });

    const response = await adapter.listAccounts({ params: {} });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual([{ resourceName: 'customers/1234567890' }]);
  });

  it('fetches campaign performance with GAQL and normalizes rows', async () => {
    const client = createClientStub([
      {
        customer: { id: '1234567890', descriptiveName: 'Main Account', currencyCode: 'USD' },
        campaign: { id: '111', name: 'Campaign', status: 'ENABLED', advertisingChannelType: 'SEARCH' },
        metrics: { costMicros: '10000000', impressions: '1000', clicks: '25', ctr: 0.025, averageCpc: '400000', averageCpm: '10000000', conversions: 5, conversionsValue: 50 },
      },
    ]);
    const adapter = new GoogleAdsAdapter({ client });

    const response = await adapter.getCampaignPerformance({
      provider: 'google',
      accountId: '1234567890',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
    });

    expect(response.ok).toBe(true);
    expect(client.calls[0]?.customerId).toBe('1234567890');
    expect(client.calls[0]?.query).toContain('FROM campaign');
    expect(client.calls[0]?.query).toContain("segments.date BETWEEN '2026-05-01' AND '2026-05-07'");
    expect(response.data?.[0]).toMatchObject({ provider: 'google', level: 'campaign', delivery: { spend: 10 } });
  });

  it('returns missing params errors before querying', async () => {
    const client = createClientStub();
    const adapter = new GoogleAdsAdapter({ client });

    const response = await adapter.getCampaignPerformance({ provider: 'google', params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('MISSING_REQUIRED_PARAMS');
    expect(client.calls).toHaveLength(0);
  });
});
