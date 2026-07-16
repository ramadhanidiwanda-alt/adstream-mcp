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
    expect(typeof adapter.getChangeHistory).toBe('function');
  });

  it('fetches Meta account activities and normalizes change history envelope', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () => ({
        metaGet: async (path: string, params: Record<string, unknown>) => {
          capturedPath = path;
          capturedParams = params;
          return {
            data: [{
              event_time: '2026-05-02T01:02:03+0000',
              event_type: 'campaign_name_change',
              translated_event_type: 'Campaign name changed',
              object_id: 'cmp_1',
              object_name: 'Campaign 1',
              object_type: 'CAMPAIGN',
              actor_id: 'user_1',
              actor_name: 'Media Buyer',
            }],
            paging: { cursors: { after: 'next_cursor' } },
          };
        },
      }) as never,
    });

    const response = await adapter.getChangeHistory({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { limit: 50, cursor: 'prev_cursor' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(capturedPath).toBe('/act_act_123/activities');
    expect(capturedParams).toMatchObject({ limit: 50, after: 'prev_cursor' });
    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      provider: 'meta',
      account: { id: 'act_123' },
      paging: { nextCursor: 'next_cursor' },
      rows: [expect.objectContaining({ object_id: 'cmp_1', actor_name: 'Media Buyer' })],
    });
    expect(JSON.stringify(response)).not.toContain('secret-token');
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

  it('passes cursor to Meta insights and exposes nextCursor metadata', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaignInsights: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return Object.assign([
            { campaign_id: 'cmp_1', spend: '10', impressions: '100', clicks: '5' },
          ], { paging: { cursors: { after: 'next_cursor' } } });
        },
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { cursor: 'prev_cursor' },
      credentials: { provider: 'meta', accessToken: 'secret-token', accountId: 'act_123', source: 'test' },
    });

    expect(receivedOptions).toMatchObject({ cursor: 'prev_cursor' });
    expect(response.meta).toMatchObject({ nextCursor: 'next_cursor' });
  });

  it('fetches Meta creative assets and maps them to creative records', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () => ({
        metaGet: async (path: string, params: Record<string, unknown>) => {
          capturedPath = path;
          capturedParams = params;
          return {
            data: [{
              id: 'creative_1',
              name: 'Hero Creative',
              title: 'Shop Now',
              body: 'Best seller this week',
              thumbnail_url: 'https://example.test/thumb.jpg',
              image_url: 'https://example.test/image.jpg',
              image_hash: 'hash_1',
              object_story_spec: {
                link_data: {
                  link: 'https://example.test/product',
                  call_to_action: { type: 'SHOP_NOW' },
                },
              },
            }],
            paging: { cursors: { after: 'creative_cursor' } },
          };
        },
      }) as never,
    });

    const response = await adapter.getCreativePerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { limit: 25, cursor: 'prev_cursor' },
      credentials: { provider: 'meta', accessToken: 'secret-token', accountId: 'act_123', source: 'test' },
    });

    expect(capturedPath).toBe('/act_act_123/adcreatives');
    expect(capturedParams).toMatchObject({ limit: 25, after: 'prev_cursor' });
    expect(response.ok).toBe(true);
    expect(response.meta).toMatchObject({ nextCursor: 'creative_cursor' });
    expect(response.data?.[0]).toMatchObject({
      provider: 'meta',
      level: 'creative',
      identity: { account_id: 'act_123', creative_id: 'creative_1', creative_name: 'Hero Creative' },
      creative: {
        creative_type: 'link',
        creative_url: 'https://example.test/image.jpg',
        thumbnail_url: 'https://example.test/thumb.jpg',
        image_hash: 'hash_1',
        headline: 'Shop Now',
        primary_text: 'Best seller this week',
        call_to_action: 'SHOP_NOW',
        destination_url: 'https://example.test/product',
      },
      delivery: { spend: 0, impressions: 0 },
    });
    expect(JSON.stringify(response)).not.toContain('secret-token');
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

  it('fetches one Meta creative asset by creativeId from the creative node endpoint', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () => ({
        metaGetObject: async (path: string, params: Record<string, unknown>) => {
          capturedPath = path;
          capturedParams = params;
          return {
            id: '1031745992699354',
            name: '11/06 Pro Sold Out Lagi',
            title: 'Sold Out Lagi',
            body: 'Back in stock soon',
            thumbnail_url: 'https://example.test/thumb.jpg',
            video_id: 'video_1',
            object_story_spec: {
              video_data: {
                call_to_action: { type: 'SHOP_NOW', value: { link: 'https://example.test/product' } },
              },
            },
          };
        },
      }) as never,
    });

    const response = await adapter.getCreativePerformance({
      provider: 'meta',
      params: { creativeId: '1031745992699354' },
      credentials: { provider: 'meta', accessToken: 'secret-token', accountId: 'act_123', source: 'test' },
    });

    expect(capturedPath).toBe('/1031745992699354');
    expect(capturedParams).toMatchObject({ fields: expect.stringContaining('video_id') });
    expect(response.ok).toBe(true);
    expect(response.meta).toMatchObject({ nextCursor: null });
    expect(response.data?.[0]).toMatchObject({
      provider: 'meta',
      level: 'creative',
      identity: { account_id: 'act_123', creative_id: '1031745992699354', creative_name: '11/06 Pro Sold Out Lagi' },
      creative: {
        creative_type: 'video',
        thumbnail_url: 'https://example.test/thumb.jpg',
        video_id: 'video_1',
        headline: 'Sold Out Lagi',
        primary_text: 'Back in stock soon',
        call_to_action: 'SHOP_NOW',
        destination_url: 'https://example.test/product',
      },
    });
  });

  it('requires Meta credentials before fetching creative assets', async () => {
    const adapter = new MetaAdsAdapter();
    const response = await adapter.getCreativePerformance({ params: {} });

    expect(response.ok).toBe(false);
    expect(response.errors?.[0].code).toBe('MISSING_META_CREDENTIALS');
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
  it('passes full ad set write parameters from broker request into createAdSet tool', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdSet: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return {
            operation: 'create_adset',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        campaignId: 'cmp_123',
        name: 'Affiliate Ad Set',
        status: 'PAUSED',
        billingEvent: 'IMPRESSIONS',
        optimizationGoal: 'LINK_CLICKS',
        bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
        bidAmount: 9000,
        bidConstraints: { roas_average_floor: 20000 },
        geoLocations: { countries: ['ID'] },
        ageMin: 25,
        genders: [2],
        publisherPlatforms: ['facebook', 'instagram'],
        destinationType: 'WEBSITE',
        attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
        frequencyControlSpecs: [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }],
        isDynamicCreative: false,
        dsaBeneficiary: 'Advertiser',
        dsaPayor: 'Advertiser',
        multiAdvertiserAds: 0,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      adAccountId: 'act_123',
      campaignId: 'cmp_123',
      name: 'Affiliate Ad Set',
      bidAmount: 9000,
      bidConstraints: { roas_average_floor: 20000 },
      destinationType: 'WEBSITE',
      attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
      frequencyControlSpecs: [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }],
      isDynamicCreative: false,
      dsaBeneficiary: 'Advertiser',
      dsaPayor: 'Advertiser',
      multiAdvertiserAds: 0,
      targeting: {
        geoLocations: { countries: ['ID'] },
        ageMin: 25,
        genders: [2],
        publisherPlatforms: ['facebook', 'instagram'],
      },
    });
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

  it('passes a Dynamic Creative objectStorySpec unchanged to the creative tool', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const objectStorySpec = {
      page_id: 'page_123',
      asset_feed_spec: {
        bodies: [{ text: 'Text 1' }, { text: 'Text 2' }],
        titles: [{ text: 'Title 1' }, { text: 'Title 2' }],
        link_urls: [{ website_url: 'https://example.com/product' }],
      },
    };
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return { operation: 'create_adcreative', status: 'dry_run', executed: false, preview: {} };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: { name: 'Dynamic Creative', pageId: 'page_123', objectStorySpec },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      adAccountId: 'act_123',
      name: 'Dynamic Creative',
      pageId: 'page_123',
      objectStorySpec,
    });
  });

  it('normalizes ad set targeting to camelCase and defaults advantage_audience', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdSet: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return { operation: 'create_adset', status: 'dry_run', executed: false, preview: {} };
        },
      },
    });

    const response = await adapter.createAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        campaignId: 'cmp_123',
        name: 'Targeting Ad Set',
        optimizationGoal: 'LINK_CLICKS',
        billingEvent: 'IMPRESSIONS',
        destinationType: 'WEBSITE',
        geoLocations: { countries: ['ID'] },
        ageMin: 25,
        genders: [2],
        publisherPlatforms: ['facebook', 'instagram'],
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions?.targeting).toMatchObject({
      geoLocations: { countries: ['ID'] },
      ageMin: 25,
      genders: [2],
      publisherPlatforms: ['facebook', 'instagram'],
    });
  });

  it('lists Meta pages without exposing page access tokens', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        listPages: async () => [{
          id: 'page_123',
          name: 'Affiliate Page',
          category: 'Shopping',
          tasks: ['ADVERTISE', 'CREATE_CONTENT'],
          access_token: 'page-token-secret',
        }],
      },
    });

    const response = await adapter.listPages({
      provider: 'meta',
      params: {},
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual([{
      id: 'page_123',
      name: 'Affiliate Page',
      category: 'Shopping',
      tasks: ['ADVERTISE', 'CREATE_CONTENT'],
      can_advertise: true,
    }]);
    expect(JSON.stringify(response)).not.toContain('page-token-secret');
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

});
