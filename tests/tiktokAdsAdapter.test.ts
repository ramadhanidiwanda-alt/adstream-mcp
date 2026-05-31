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
    expect(typeof adapter.getCampaignPerformance).toBe('function');
    expect(typeof adapter.getAdsetOrAdgroupPerformance).toBe('function');
    expect(typeof adapter.getAdPerformance).toBe('function');
    expect(typeof adapter.getCreativePerformance).toBe('function');
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
});
