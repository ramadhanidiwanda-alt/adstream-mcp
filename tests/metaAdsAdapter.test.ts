import { describe, expect, it } from 'vitest';
import { MetaAdsAdapter } from '../src/providers/meta/MetaAdsAdapter.js';

describe('MetaAdsAdapter', () => {
  it('implements required adapter contract shape', () => {
    const adapter = new MetaAdsAdapter();

    expect(adapter.id).toBe('meta');
    expect(adapter.displayName).toBe('Meta Ads');
    expect(adapter.capabilities.operations).toEqual(['read', 'write']);
    expect(typeof adapter.listAccounts).toBe('function');
    expect(typeof adapter.getAccountPerformance).toBe('function');
    expect(typeof adapter.getCampaignPerformance).toBe('function');
    expect(typeof adapter.getAdsetOrAdgroupPerformance).toBe('function');
    expect(typeof adapter.getAdPerformance).toBe('function');
    expect(typeof adapter.getCreativePerformance).toBe('function');
    expect(typeof adapter.getPlacementPerformance).toBe('function');
  });


  it('wraps account insights tool and normalizes account-level response', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getAccountInsights: async () => [
          {
            account_id: 'act_123',
            account_name: 'Main Account',
            spend: '100',
            impressions: '1000',
            reach: '800',
            clicks: '50',
            inline_link_clicks: '40',
            ctr: '5',
            cpc: '2',
            cpm: '100',
            actions: [{ action_type: 'purchase', value: '4' }],
            action_values: [{ action_type: 'purchase', value: '500' }],
          },
        ],
      },
    });

    const response = await adapter.getAccountPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-01-01',
      until: '2026-06-24',
      params: {},
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0].level).toBe('account');
    expect(response.data?.[0].identity.account_name).toBe('Main Account');
    expect(response.data?.[0].delivery.spend).toBe(100);
    expect(response.data?.[0].commerce?.purchases).toBe(4);
    expect(response.data?.[0].commerce?.purchase_value).toBe(500);
    expect(response.data?.[0].commerce?.purchase_roas).toBe(5);
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

  it('enables CPAS mode as Meta campaign performance parameters', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaignInsights: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return [
            {
              campaign_id: 'cmp_1',
              campaign_name: 'CPAS Campaign',
              product_id: 'sku_1',
              product_name: 'Hero SKU',
              product_set_id: 'set_1',
              catalog_segment_id: 'segment_1',
              spend: '10',
              impressions: '100',
              reach: '90',
              clicks: '5',
              inline_link_clicks: '4',
              ctr: '5',
              cpc: '2',
              cpm: '100',
              actions: [{ action_type: 'purchase', value: '2' }],
              action_values: [{ action_type: 'purchase', value: '200' }],
            },
          ];
        },
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { mode: 'cpas', limit: 25 },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      adAccountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      limit: 25,
      breakdowns: ['product_id'],
    });
    expect(response.meta).toMatchObject({ mode: 'cpas' });
    expect(response.data?.[0]).toMatchObject({
      setup: { buying_type: 'cpas' },
      commerce: { purchases: 2, purchase_value: 200, purchase_roas: 20 },
      dimensions: {
        product_id: 'sku_1',
        product_name: 'Hero SKU',
        product_set_id: 'set_1',
        catalog_segment_id: 'segment_1',
      },
    });
  });

  it('returns safe not-implemented response for creative performance', async () => {
    const adapter = new MetaAdsAdapter();
    const response = await adapter.getCreativePerformance({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('NOT_IMPLEMENTED');
  });

  it('forwards placement filter params to Meta placement tool', async () => {
    let receivedOptions;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getMetaPlacementPerformance: async (_client, options) => {
          receivedOptions = options;
          return {
            provider: 'meta',
            date_range: { since: options.since, until: options.until },
            totals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, cpm: 0 },
            placements: [],
            summary: { insufficient_data: [] },
            warnings: [],
          };
        },
      },
    });

    const response = await adapter.getPlacementPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { level: 'ad', campaignId: 'cmp_1', adsetId: ['adset_1'], adId: 'ad_1' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      level: 'ad',
      campaignId: 'cmp_1',
      adsetId: ['adset_1'],
      adId: 'ad_1',
    });
  });

  it('lists campaigns via getCampaigns tool', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaigns: async () => [
          {
            id: '123',
            name: 'Conversion Campaign',
            status: 'ACTIVE',
            effective_status: 'ACTIVE',
            objective: 'OUTCOME_SALES',
            created_time: '2026-01-15T08:00:00+0000',
            updated_time: '2026-06-20T12:00:00+0000',
          },
        ],
      },
    });

    const response = await adapter.listCampaigns({
      provider: 'meta',
      accountId: 'act_123',
      params: {},
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.[0]).toMatchObject({ id: '123', name: 'Conversion Campaign' });
  });

  it('returns MISSING_ACCOUNT_ID when listing campaigns without accountId', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaigns: async () => [],
      },
    });

    const response = await adapter.listCampaigns({
      provider: 'meta',
      params: {},
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        source: 'test',
      },
    });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('MISSING_ACCOUNT_ID');
  });

  it('implements listCampaigns method on adapter contract', () => {
    const adapter = new MetaAdsAdapter();
    expect(typeof adapter.listCampaigns).toBe('function');
  });
});
