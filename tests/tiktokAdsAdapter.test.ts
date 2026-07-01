import { describe, expect, it } from 'vitest';
import { AdsBroker } from '../src/broker/AdsBroker.js';
import { ProviderRegistry } from '../src/broker/providerRegistry.js';
import { TikTokAdsAdapter } from '../src/providers/tiktok/TikTokAdsAdapter.js';
import type { CredentialResolveResult } from '../src/broker/credentials.js';

class StubCredentialResolver {
  constructor(private readonly result: CredentialResolveResult) {}
  async resolve(): Promise<CredentialResolveResult> {
    return this.result;
  }
}

describe('TikTokAdsAdapter', () => {
  it('implements required adapter contract shape', () => {
    const adapter = new TikTokAdsAdapter();

    expect(adapter.id).toBe('tiktok');
    expect(adapter.displayName).toBe('TikTok Ads');
    expect(adapter.capabilities.operations).toEqual(['read']);
    expect(typeof adapter.listAccounts).toBe('function');
    expect(typeof adapter.getAccountPerformance).toBe('function');
    expect(typeof adapter.getCampaignPerformance).toBe('function');
    expect(typeof adapter.getAdsetOrAdgroupPerformance).toBe('function');
    expect(typeof adapter.getAdPerformance).toBe('function');
    expect(typeof adapter.getCreativePerformance).toBe('function');
  });


  it('returns NOT_IMPLEMENTED for account performance when no client or mock data is configured', async () => {
    const adapter = new TikTokAdsAdapter();
    const response = await adapter.getAccountPerformance({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });

  it('returns normalized mock account performance in test mode', async () => {
    const adapter = new TikTokAdsAdapter({
      mockData: {
        account: [
          {
            advertiser_id: 'advertiser_1',
            spend: '500',
            impressions: '10000',
            clicks: '400',
            conversions: '20',
            conversion_value: '2000',
          },
        ],
      },
    });

    const response = await adapter.getAccountPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_1',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
      credentials: { provider: 'tiktok', accessToken: 'secret-token', accountId: 'advertiser_1', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].level).toBe('account');
    expect(response.data?.[0].provider).toBe('tiktok');
    expect(response.data?.[0].delivery.spend).toBe(500);
    expect(response.data?.[0].conversions?.conversion_value).toBe(2000);
    expect(response.data?.[0].raw).toBeUndefined();
  });

  it('fetches account performance via TikTok API client with advertiser-level report', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new TikTokAdsAdapter({
      client: {
        get: async (path: string, params: Record<string, unknown> = {}) => {
          capturedPath = path;
          capturedParams = params;
          return {
            list: [
              {
                dimensions: { advertiser_id: 'advertiser_123' },
                metrics: {
                  spend: '750',
                  impressions: '15000',
                  clicks: '600',
                  ctr: '4',
                  cpc: '1.25',
                  cpm: '50',
                  conversions: '30',
                  conversion_value: '3000',
                },
              },
            ],
            page_info: { page: 1, page_size: 100, total_number: 1, total_page: 1 },
          };
        },
      } as never,
    });

    const response = await adapter.getAccountPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
      credentials: { provider: 'tiktok', accessToken: 'x', accountId: 'advertiser_123', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(capturedPath).toBe('/report/integrated/get/');
    expect(capturedParams?.data_level).toBe('AUCTION_ADVERTISER');
    expect(capturedParams?.dimensions).toEqual(['advertiser_id']);
    expect(response.data?.[0].level).toBe('account');
    expect(response.data?.[0].identity.account_id).toBe('advertiser_123');
    expect(response.data?.[0].delivery.spend).toBe(750);
    expect(response.data?.[0].conversions?.conversion_value).toBe(3000);
  });

  it('fetches placement performance via TikTok API client', async () => {
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new TikTokAdsAdapter({
      client: {
        get: async (_path: string, params: Record<string, unknown> = {}) => {
          capturedParams = params;
          return {
            list: [
              {
                dimensions: { adgroup_id: 'adgroup_1' },
                metrics: {
                  placement_type: 'PLACEMENT_TIKTOK',
                  spend: '250',
                  impressions: '5000',
                  clicks: '125',
                  ctr: '2.5',
                  cpc: '2',
                  cpm: '50',
                  conversions: '10',
                  conversion_value: '1000',
                },
              },
            ],
            page_info: { page: 1, page_size: 100, total_number: 1, total_page: 1 },
          };
        },
      } as never,
    });

    const response = await adapter.getPlacementPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
      credentials: { provider: 'tiktok', accessToken: 'x', accountId: 'advertiser_123', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(capturedParams?.data_level).toBe('AUCTION_ADGROUP');
    expect(capturedParams?.dimensions).toEqual(['adgroup_id']);
    expect(capturedParams?.metrics).toContain('placement_type');
    expect(response.data?.[0]).toMatchObject({
      provider: 'tiktok',
      level: 'account',
      identity: { account_id: 'advertiser_123' },
      dimensions: { placement: 'PLACEMENT_TIKTOK', platform: 'tiktok' },
      delivery: { spend: 250, impressions: 5000 },
      clicks: { clicks: 125, ctr: 2.5, cpc: 2 },
      conversions: { conversions: 10, conversion_value: 1000 },
    });
  });

  it('returns NOT_IMPLEMENTED when no mock data is configured', async () => {
    const adapter = new TikTokAdsAdapter();
    const response = await adapter.getCampaignPerformance({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });

  it('returns normalized mock campaign performance in test mode', async () => {
    const adapter = new TikTokAdsAdapter({
      mockData: {
        campaigns: [
          {
            campaign_id: 'cmp_1',
            campaign_name: 'TikTok Campaign',
            spend: '100',
            impressions: '1000',
            clicks: '50',
            conversions: '5',
          },
        ],
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_1',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
      credentials: { provider: 'tiktok', accessToken: 'secret-token', accountId: 'advertiser_1', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].provider).toBe('tiktok');
    expect(response.data?.[0].delivery.spend).toBe(100);
    expect(response.data?.[0].conversions?.conversions).toBe(5);
    expect(response.data?.[0].raw).toBeUndefined();
  });

  it('can be registered and retrieved from ProviderRegistry', () => {
    const registry = new ProviderRegistry();
    const adapter = new TikTokAdsAdapter();
    registry.register(adapter);

    expect(registry.get('tiktok')).toBe(adapter);
  });

  it('can be called by AdsBroker and returns safe response', async () => {
    const registry = new ProviderRegistry();
    registry.register(
      new TikTokAdsAdapter({
        mockData: {
          campaigns: [{ campaign_id: 'cmp_1', spend: '10', impressions: '100', clicks: '5' }],
        },
      })
    );
    const broker = new AdsBroker({
      providerRegistry: registry,
      credentialResolver: new StubCredentialResolver({
        ok: true,
        credential: { provider: 'tiktok', accessToken: 'secret-token', accountId: 'advertiser_1', source: 'test' },
      }),
    });

    const response = await broker.getCampaignPerformance({
      provider: 'tiktok',
      accountId: 'advertiser_1',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].provider).toBe('tiktok');
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

  it('returns NOT_IMPLEMENTED for listCampaigns when no client configured', async () => {
    const adapter = new TikTokAdsAdapter();
    const response = await adapter.listCampaigns({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });

  it('returns MISSING_ACCOUNT_ID for listCampaigns with client but no accountId', async () => {
    const adapter = new TikTokAdsAdapter({
      client: { get: async () => ({ list: [] }) } as never,
    });

    const response = await adapter.listCampaigns({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('MISSING_ACCOUNT_ID');
  });

  it('lists campaigns via TikTok API client', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new TikTokAdsAdapter({
      client: {
        get: async (path: string, params: Record<string, unknown> = {}) => {
          capturedPath = path;
          capturedParams = params;
          return {
            list: [
              {
                campaign_id: 'cmp_1',
                campaign_name: 'TikTok Campaign A',
                objective: 'VIDEO_VIEWS',
                status: 'CAMPAIGN_STATUS_ENABLE',
              },
            ],
          };
        },
      } as never,
    });

    const response = await adapter.listCampaigns({
      provider: 'tiktok',
      accountId: 'advertiser_123',
      params: {},
      credentials: { provider: 'tiktok', accessToken: 'x', accountId: 'advertiser_123', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(capturedPath).toBe('/campaign/get/');
    expect(capturedParams?.advertiser_id).toBe('advertiser_123');
    expect(response.data?.[0]).toMatchObject({ campaign_id: 'cmp_1', campaign_name: 'TikTok Campaign A' });
  });

  it('implements listCampaigns method on adapter contract', () => {
    const adapter = new TikTokAdsAdapter();
    expect(typeof adapter.listCampaigns).toBe('function');
  });
});
