import { describe, expect, it } from 'vitest';
import { MetaAdsAdapter } from '../src/providers/meta/MetaAdsAdapter.js';

describe('MetaAdsAdapter', () => {
  it('implements required adapter contract shape', () => {
    const adapter = new MetaAdsAdapter();

    expect(adapter.id).toBe('meta');
    expect(adapter.displayName).toBe('Meta Ads');
    expect(adapter.capabilities.operations).toEqual(['read']);
    expect(typeof adapter.listAccounts).toBe('function');
    expect(typeof adapter.getCampaignPerformance).toBe('function');
    expect(typeof adapter.getAdsetOrAdgroupPerformance).toBe('function');
    expect(typeof adapter.getAdPerformance).toBe('function');
    expect(typeof adapter.getCreativePerformance).toBe('function');
  });

  it('wraps existing campaign insights tool and normalizes response', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaignInsights: async () => [
          {
            campaign_id: 'cmp_1',
            campaign_name: 'Campaign 1',
            spend: '10',
            impressions: '100',
            reach: '80',
            clicks: '5',
            inline_link_clicks: '4',
            ctr: '5',
            cpc: '2',
            cpm: '100',
          },
        ],
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].provider).toBe('meta');
    expect(response.data?.[0].level).toBe('campaign');
    expect(response.data?.[0].delivery.spend).toBe(10);
    expect(response.data?.[0].raw).toBeUndefined();
  });

  it('returns safe not-implemented response for creative performance', async () => {
    const adapter = new MetaAdsAdapter();
    const response = await adapter.getCreativePerformance({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });
});
