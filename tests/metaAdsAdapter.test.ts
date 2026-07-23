import { describe, expect, it } from 'vitest';
import { MetaAdsAdapter } from '../src/providers/meta/MetaAdsAdapter.js';
import { MetaApiError } from '../src/utils/metaError.js';

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

  it('returns human-readable launch readiness questions for non-coding users', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
    });

    const response = await adapter.checkLaunchReadiness({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        workflow: 'whatsapp_sales',
        productOrOffer: 'Skincare bundle',
        dailyBudget: 100000,
        countries: ['ID'],
        destinationUrl: 'https://wa.me/628123456789',
        writesEnabled: true,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({
      ready: false,
      workflow: 'whatsapp_sales',
      recommendedWorkflow: 'whatsapp_sales',
      missing: expect.arrayContaining(['pageId', 'whatsappPhoneNumberId', 'creativeAsset']),
      nextQuestions: expect.arrayContaining([
        'Page Facebook mana yang mau dipakai untuk iklan ini?',
      ]),
      summary: expect.stringContaining('Belum siap'),
      writesEnabled: true,
    });
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

  it('lists pixels, catalogs, and product sets from Meta discovery endpoints', async () => {
    const captured: Array<{ path: string; params: Record<string, unknown> }> = [];
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (path: string, params: Record<string, unknown>) => {
            captured.push({ path, params });
            if (path === '/act_123/adspixels') {
              return { data: [{ id: 'pixel-1', name: 'Pixel 1', last_fired_time: '2026-07-19' }] };
            }
            if (path === '/business-1/owned_product_catalogs') {
              return { data: [{ id: 'catalog-1', name: 'Catalog 1', product_count: 10 }] };
            }
            if (path === '/catalog-1/product_sets') {
              return {
                data: [
                  {
                    id: 'set-1',
                    name: 'Shoes',
                    product_count: 5,
                    product_catalog: { id: 'catalog-1' },
                  },
                ],
              };
            }
            return { data: [] };
          },
        }) as never,
    });
    const baseRequest = {
      provider: 'meta' as const,
      accountId: 'act_123',
      credentials: {
        provider: 'meta' as const,
        accessToken: 'secret-token',
        source: 'test' as const,
      },
    };

    await expect(
      adapter.listPixels({ ...baseRequest, params: { limit: 25 } })
    ).resolves.toMatchObject({
      ok: true,
      data: [{ id: 'pixel-1', name: 'Pixel 1', last_fired_time: '2026-07-19' }],
    });
    await expect(
      adapter.listCatalogs({ ...baseRequest, params: { businessId: 'business-1' } })
    ).resolves.toMatchObject({
      ok: true,
      data: [{ id: 'catalog-1', name: 'Catalog 1', product_count: 10 }],
    });
    await expect(
      adapter.listProductSets({ ...baseRequest, params: { catalogId: 'catalog-1' } })
    ).resolves.toMatchObject({
      ok: true,
      data: [{ id: 'set-1', name: 'Shoes', product_count: 5, catalog_id: 'catalog-1' }],
    });

    expect(captured.map(({ path }) => path)).toEqual([
      '/act_123/adspixels',
      '/business-1/owned_product_catalogs',
      '/catalog-1/product_sets',
    ]);
    expect(JSON.stringify(captured)).not.toContain('secret-token');
  });

  it('lists Instagram media for a connected IG Business account', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (path: string) => {
            expect(path).toBe('/ig-1/media');
            return {
              data: [
                {
                  id: '178956',
                  permalink: 'https://www.instagram.com/reel/DbFng09vfYg/',
                  media_type: 'VIDEO',
                  media_product_type: 'REELS',
                },
              ],
            };
          },
        }) as never,
    });

    await expect(
      adapter.listInstagramMedia({
        provider: 'meta',
        accountId: 'act_123',
        params: { igUserId: 'ig-1' },
        credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
      })
    ).resolves.toMatchObject({
      ok: true,
      data: [
        {
          id: '178956',
          permalink: 'https://www.instagram.com/reel/DbFng09vfYg/',
          mediaType: 'VIDEO',
          mediaProductType: 'REELS',
        },
      ],
    });
  });

  it('rejects listInstagramMedia without igUserId', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: () => ({ metaGet: async () => ({ data: [] }) }) as never,
    });

    await expect(
      adapter.listInstagramMedia({
        provider: 'meta',
        accountId: 'act_123',
        params: {},
        credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
      })
    ).resolves.toMatchObject({
      ok: false,
      errors: [{ code: 'MISSING_IG_USER_ID' }],
    });
  });

  it('fetches Meta account activities and normalizes change history envelope', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (path: string, params: Record<string, unknown>) => {
            capturedPath = path;
            capturedParams = params;
            return {
              data: [
                {
                  event_time: '2026-05-02T01:02:03+0000',
                  event_type: 'campaign_name_change',
                  translated_event_type: 'Campaign name changed',
                  object_id: 'cmp_1',
                  object_name: 'Campaign 1',
                  object_type: 'CAMPAIGN',
                  actor_id: 'user_1',
                  actor_name: 'Media Buyer',
                },
              ],
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

    expect(capturedPath).toBe('/act_123/activities');
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

  it('accepts a bare numeric accountId for change history without double-prefixing act_', async () => {
    let capturedPath: string | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (path: string) => {
            capturedPath = path;
            return { data: [], paging: {} };
          },
        }) as never,
    });

    await adapter.getChangeHistory({
      provider: 'meta',
      accountId: '123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {},
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: '123',
        source: 'test',
      },
    });

    expect(capturedPath).toBe('/act_123/activities');
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
          return Object.assign(
            [{ campaign_id: 'cmp_1', spend: '10', impressions: '100', clicks: '5' }],
            { paging: { cursors: { after: 'next_cursor' } } }
          );
        },
      },
    });

    const response = await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { cursor: 'prev_cursor' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(receivedOptions).toMatchObject({ cursor: 'prev_cursor' });
    expect(response.meta).toMatchObject({ nextCursor: 'next_cursor' });
  });

  it('threads params.adsetId (and params.adSetId alias) from the request into getAdsetInsights', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getAdsetInsights: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return [];
        },
      },
    });

    await adapter.getAdsetOrAdgroupPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { adsetId: '120251877326190415', campaignId: '120216685951590415' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(receivedOptions).toMatchObject({
      adsetId: '120251877326190415',
      campaignId: '120216685951590415',
    });

    // Regression: the alias used by other tools (adSetId) must also work,
    // since callers reasonably guess either casing.
    await adapter.getAdsetOrAdgroupPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { adSetId: '120251877326190415' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(receivedOptions).toMatchObject({ adsetId: '120251877326190415' });
  });

  it('translates canonical performance filters before calling Meta insights', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getCampaignInsights: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return [];
        },
      },
    });

    await adapter.getCampaignPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: {
        filters: [
          { field: 'campaign.status', operator: 'eq', value: 'ACTIVE' },
          { field: 'impressions', operator: 'gte', value: 100 },
        ],
      },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(receivedOptions).toMatchObject({
      explicitFilters: [
        { field: 'campaign.status', operator: 'EQUAL', value: 'ACTIVE' },
        { field: 'impressions', operator: 'GREATER_THAN_OR_EQUAL', value: 100 },
      ],
    });
  });

  it('warns when getPerformance returns fewer rows than requested but more data exists', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getAdsInsights: async () =>
          Object.assign(
            [
              {
                ad_id: 'ad_1',
                campaign_id: 'c',
                adset_id: 'as',
                spend: '1',
                impressions: '1',
                clicks: '0',
              },
            ],
            { paging: { cursors: { after: 'more_data_cursor' } } }
          ),
      },
    });

    const response = await adapter.getAdPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { limit: 200 },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.meta?.warnings).toMatchObject([{ code: 'PARTIAL_PAGE' }]);
  });

  it('does not warn when getPerformance returns as many rows as requested', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      ad_id: `ad_${i}`,
      campaign_id: 'c',
      adset_id: 'as',
      spend: '1',
      impressions: '1',
      clicks: '0',
    }));
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getAdsInsights: async () =>
          Object.assign(rows, { paging: { cursors: { after: 'more_data_cursor' } } }),
      },
    });

    const response = await adapter.getAdPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { limit: 3 },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.meta?.warnings).toBeUndefined();
  });

  it('does not warn when a short page has no nextCursor (genuinely the last page)', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        getAdsInsights: async () =>
          Object.assign(
            [
              {
                ad_id: 'ad_1',
                campaign_id: 'c',
                adset_id: 'as',
                spend: '1',
                impressions: '1',
                clicks: '0',
              },
            ],
            { paging: {} }
          ),
      },
    });

    const response = await adapter.getAdPerformance({
      provider: 'meta',
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      params: { limit: 200 },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.meta?.warnings).toBeUndefined();
  });

  it('warns when getAdDestinations returns fewer ads than requested but more data exists', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async () => ({
            data: [{ id: 'ad_1', name: 'POSTER', status: 'ACTIVE', effective_status: 'ACTIVE' }],
            paging: { cursors: { after: 'more_ads_cursor' } },
          }),
        }) as never,
    });

    const response = await adapter.getAdDestinations({
      provider: 'meta',
      accountId: 'act_123',
      params: { limit: 100 },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.meta?.warnings).toMatchObject([{ code: 'PARTIAL_PAGE' }]);
  });

  it('passes raw Meta filtering through creative mapping and destination adapters', async () => {
    const capturedParams: Array<Record<string, unknown>> = [];
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (_path: string, params: Record<string, unknown>) => {
            capturedParams.push(params);
            return { data: [], paging: {} };
          },
        }) as never,
    });
    const request = {
      provider: 'meta' as const,
      accountId: 'act_123',
      params: {
        filtering: [{ field: 'impressions', operator: 'GREATER_THAN', value: 100 }],
      },
      credentials: {
        provider: 'meta' as const,
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    };

    await adapter.getAdCreativeMapping(request);
    await adapter.getAdDestinations(request);

    expect(capturedParams).toHaveLength(2);
    for (const params of capturedParams) {
      expect(JSON.parse(String(params.filtering))).toContainEqual({
        field: 'impressions',
        operator: 'GREATER_THAN',
        value: 100,
      });
    }
  });

  it('fetches Meta creative assets and maps them to creative records', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (path: string, params: Record<string, unknown>) => {
            capturedPath = path;
            capturedParams = params;
            return {
              data: [
                {
                  id: 'creative_1',
                  name: 'Hero Creative',
                  title: 'Shop Now',
                  body: 'Best seller this week',
                  thumbnail_url: 'https://example.test/thumb.jpg',
                  image_url: 'https://example.test/image.jpg',
                  image_hash: 'hash_1',
                  degrees_of_freedom_spec: {
                    creative_features_spec: {
                      image_auto_crop: { enroll_status: 'OPT_OUT' },
                      text_generation: { enroll_status: 'OPT_OUT' },
                    },
                  },
                  media_sourcing_spec: { related_media: [] },
                  asset_feed_spec: {
                    images: [
                      { hash: 'feed_hash', adlabels: [{ name: 'feed_asset' }] },
                      { hash: 'vertical_hash', adlabels: [{ name: 'vertical_asset' }] },
                    ],
                    asset_customization_rules: [
                      {
                        image_label: { name: 'feed_asset' },
                        customization_spec: {
                          publisher_platforms: ['facebook', 'instagram'],
                          facebook_positions: ['feed'],
                          instagram_positions: ['stream'],
                        },
                      },
                      {
                        image_label: { name: 'vertical_asset' },
                        customization_spec: {
                          publisher_platforms: ['facebook', 'instagram'],
                          facebook_positions: ['facebook_reels', 'story'],
                          instagram_positions: ['reels', 'story'],
                        },
                      },
                    ],
                  },
                  object_story_spec: {
                    link_data: {
                      link: 'https://example.test/product',
                      call_to_action: { type: 'SHOP_NOW' },
                    },
                  },
                },
              ],
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
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        apiVersion: 'v23.0',
        source: 'test',
      },
    });

    expect(capturedPath).toBe('/act_123/adcreatives');
    expect(capturedParams).toMatchObject({ limit: 25, after: 'prev_cursor' });
    for (const field of [
      'status',
      'degrees_of_freedom_spec',
      'media_sourcing_spec',
      'asset_feed_spec',
      'platform_customizations',
      'portrait_customizations',
      'image_crops',
    ]) {
      expect(capturedParams).toMatchObject({ fields: expect.stringContaining(field) });
    }
    expect(response.ok).toBe(true);
    expect(response.meta).toMatchObject({ nextCursor: 'creative_cursor' });
    expect(response.data?.[0]).toMatchObject({
      provider: 'meta',
      level: 'creative',
      identity: {
        account_id: 'act_123',
        creative_id: 'creative_1',
        creative_name: 'Hero Creative',
      },
      creative: {
        creative_type: 'link',
        creative_url: 'https://example.test/image.jpg',
        thumbnail_url: 'https://example.test/thumb.jpg',
        image_hash: 'hash_1',
        headline: 'Shop Now',
        primary_text: 'Best seller this week',
        call_to_action: 'SHOP_NOW',
        destination_url: 'https://example.test/product',
        setup_compliance: {
          ai_creative: { status: 'PASS', enabled_features: [] },
          related_media: { status: 'PASS' },
          placement_customization: {
            status: 'PASS',
            feed: 'PASS',
            reels: 'PASS',
            story: 'PASS',
            preview_required: true,
          },
        },
      },
      delivery: { spend: 0, impressions: 0 },
    });
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

  it('omits media_sourcing_spec on Meta API versions that do not support it', async () => {
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (_path: string, params: Record<string, unknown>) => {
            capturedParams = params;
            return { data: [{ id: 'creative_legacy', name: 'Legacy Creative' }] };
          },
        }) as never,
    });

    const response = await adapter.getCreativePerformance({
      provider: 'meta',
      accountId: 'act_123',
      params: {},
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        apiVersion: 'v20.0',
        source: 'test',
      },
    });

    expect(capturedParams?.fields).not.toContain('media_sourcing_spec');
    expect(response.data?.[0]?.creative?.setup_compliance?.related_media.status).toBe('UNKNOWN');
  });

  it('audits active ads with their ad set placement targeting', async () => {
    let capturedPath: string | undefined;
    let capturedParams: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async (path: string, params: Record<string, unknown>) => {
            capturedPath = path;
            capturedParams = params;
            return {
              data: [
                {
                  id: 'ad_1',
                  name: 'Active Ad',
                  status: 'ACTIVE',
                  effective_status: 'ACTIVE',
                  adset: {
                    id: 'adset_1',
                    name: 'Main Ad Set',
                    targeting: {
                      publisher_platforms: ['facebook', 'instagram'],
                      facebook_positions: ['feed', 'facebook_reels'],
                      instagram_positions: ['stream', 'reels'],
                    },
                  },
                  creative: {
                    id: 'creative_1',
                    name: 'Hero Creative',
                    degrees_of_freedom_spec: {
                      creative_features_spec: {
                        standard_enhancements: { enroll_status: 'OPT_OUT' },
                      },
                    },
                  },
                },
              ],
              paging: { cursors: { after: 'next_active_ad' } },
            };
          },
        }) as never,
    });

    const response = await adapter.getCreativePerformance({
      provider: 'meta',
      accountId: 'act_123',
      params: { complianceAudit: true, limit: 10 },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        apiVersion: 'v23.0',
        source: 'test',
      },
    });

    expect(capturedPath).toBe('/act_123/ads');
    expect(capturedParams).toMatchObject({
      limit: 10,
      fields: expect.stringContaining('adset{id,name,targeting}'),
      filtering: expect.stringContaining('ACTIVE'),
    });
    expect(response.data?.[0]).toMatchObject({
      identity: {
        ad_id: 'ad_1',
        ad_name: 'Active Ad',
        adset_or_adgroup_id: 'adset_1',
        adset_or_adgroup_name: 'Main Ad Set',
        creative_id: 'creative_1',
      },
      setup: { status: 'ACTIVE', effective_status: 'ACTIVE' },
      creative: {
        setup_compliance: {
          ai_creative: { status: 'PASS' },
          related_media: { status: 'PASS' },
          placement_customization: {
            status: 'FAIL',
            feed: 'FAIL',
            reels: 'FAIL',
            story: 'NOT_APPLICABLE',
          },
        },
      },
    });
    expect(response.meta).toMatchObject({ nextCursor: 'next_active_ad' });
  });

  it('wraps compliance audit permission failures with actionable guidance', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async () => {
            throw new MetaApiError({
              message: 'Application does not have the capability to make this API call.',
              type: 'OAuthException',
              code: 3,
            });
          },
        }) as never,
    });

    const response = await adapter.getCreativePerformance({
      provider: 'meta',
      accountId: 'act_123',
      params: { complianceAudit: true },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response).toMatchObject({
      ok: false,
      errors: [
        {
          code: 'META_COMPLIANCE_AUDIT_PERMISSION_REQUIRED',
          message: expect.stringContaining('ads_read'),
        },
      ],
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
      clientFactory: () =>
        ({
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
                  call_to_action: {
                    type: 'SHOP_NOW',
                    value: { link: 'https://example.test/product' },
                  },
                },
              },
            };
          },
        }) as never,
    });

    const response = await adapter.getCreativePerformance({
      provider: 'meta',
      params: { creativeId: '1031745992699354' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        apiVersion: 'v23.0',
        source: 'test',
      },
    });

    expect(capturedPath).toBe('/1031745992699354');
    expect(capturedParams).toMatchObject({ fields: expect.stringContaining('video_id') });
    for (const field of [
      'status',
      'degrees_of_freedom_spec',
      'media_sourcing_spec',
      'asset_feed_spec',
      'platform_customizations',
      'portrait_customizations',
      'image_crops',
    ]) {
      expect(capturedParams).toMatchObject({ fields: expect.stringContaining(field) });
    }
    expect(response.ok).toBe(true);
    expect(response.meta).toMatchObject({ nextCursor: null });
    expect(response.data?.[0]).toMatchObject({
      provider: 'meta',
      level: 'creative',
      identity: {
        account_id: 'act_123',
        creative_id: '1031745992699354',
        creative_name: '11/06 Pro Sold Out Lagi',
      },
      creative: {
        creative_type: 'video',
        thumbnail_url: 'https://example.test/thumb.jpg',
        video_id: 'video_1',
        headline: 'Sold Out Lagi',
        primary_text: 'Back in stock soon',
        call_to_action: 'SHOP_NOW',
        destination_url: 'https://example.test/product',
        setup_compliance: {
          ai_creative: { status: 'NOT_APPLICABLE' },
          related_media: { status: 'PASS' },
          placement_customization: {
            status: 'UNKNOWN',
            preview_required: true,
          },
        },
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

  it('wires behaviors/workEmployers/workPositions into a single flexibleSpec group, and params.targeting into metaTargetingOverride', async () => {
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
        name: 'Behaviors Test Ad Set',
        interests: [{ id: 'int_1', name: 'Movies' }],
        behaviors: [{ id: 'beh_1', name: 'Engaged Shoppers' }],
        workEmployers: [{ id: 'emp_1', name: 'Tech Company' }],
        workPositions: [{ id: 'pos_1', name: 'Engineer' }],
        targeting: { excluded_geo_locations: { countries: ['US'] } },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    const targeting = (receivedOptions?.targeting ?? {}) as Record<string, unknown>;
    expect(targeting.interests).toEqual([{ id: 'int_1', name: 'Movies' }]);
    expect(targeting.flexibleSpec).toEqual([
      {
        behaviors: [{ id: 'beh_1', name: 'Engaged Shoppers' }],
        work_employers: [{ id: 'emp_1', name: 'Tech Company' }],
        work_positions: [{ id: 'pos_1', name: 'Engineer' }],
      },
    ]);
    expect(targeting.metaTargetingOverride).toEqual({
      excluded_geo_locations: { countries: ['US'] },
    });
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
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
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

  it('forwards urlTags to the Meta creative tool as URL parameters', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const urlTags =
      'utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.id}}';
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Creative with URL tags',
        pageId: 'page_123',
        link: 'https://example.com',
        message: 'Belanja sekarang',
        urlTags,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      adAccountId: 'act_123',
      name: 'Creative with URL tags',
      urlTags,
    });
  });

  it('forwards canonical campaign and ad set fields as typed options', async () => {
    let campaignOptions: Record<string, unknown> | undefined;
    let adSetOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createCampaign: async (_client, options) => {
          campaignOptions = options as unknown as Record<string, unknown>;
          return {
            operation: 'create_campaign',
            status: 'dry_run',
            executed: false,
            preview: {},
            mode: options.mode ?? 'standard',
          };
        },
        createAdSet: async (_client, options) => {
          adSetOptions = options as unknown as Record<string, unknown>;
          return { operation: 'create_adset', status: 'dry_run', executed: false, preview: {} };
        },
      },
    });

    const credentials = {
      provider: 'meta' as const,
      accessToken: 'secret-token',
      source: 'test',
    };
    const campaignResponse = await adapter.createCampaign({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Collaborative campaign',
        objective: 'OUTCOME_SALES',
        mode: 'collaborative_ads',
        isAdSetBudgetSharingEnabled: true,
      },
      credentials,
    });
    await adapter.createAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        campaignId: 'campaign-1',
        name: 'Collaborative ad set',
        mode: 'collaborative_ads',
        collaborativeCatalog: {
          productSetId: 'set-1',
          pixelId: 'pixel-1',
          customEventType: 'PURCHASE',
          destinationUrl: 'https://example.com/catalog',
          applicationId: 'shopee-app',
          objectStoreUrls: [
            'http://play.google.com/store/apps/details?id=com.shopee.id',
            'http://itunes.apple.com/app/id959841443',
          ],
        },
      },
      credentials,
    });

    expect(campaignOptions).toMatchObject({
      mode: 'collaborative_ads',
      isAdSetBudgetSharingEnabled: true,
    });
    expect(campaignResponse.data?.mode).toBe('collaborative_ads');
    expect(adSetOptions).toMatchObject({
      mode: 'collaborative_ads',
      collaborativeCatalog: {
        productSetId: 'set-1',
        pixelId: 'pixel-1',
        customEventType: 'PURCHASE',
        destinationUrl: 'https://example.com/catalog',
        applicationId: 'shopee-app',
        objectStoreUrls: [
          'http://play.google.com/store/apps/details?id=com.shopee.id',
          'http://itunes.apple.com/app/id959841443',
        ],
      },
    });
  });

  const canonicalCreativeCases: Array<{
    creativeFormat: string;
    creativeSpec: Record<string, unknown>;
  }> = [
    {
      creativeFormat: 'single_image',
      creativeSpec: {
        imageHash: 'image-1',
        primaryText: 'Single image copy',
        destinationUrl: 'https://example.com/image',
        headline: 'Image headline',
      },
    },
    {
      creativeFormat: 'video',
      creativeSpec: {
        videoId: 'video-1',
        primaryText: 'Video copy',
        destinationUrl: 'https://example.com/video',
        thumbnailImageHash: 'thumb-1',
      },
    },
    {
      creativeFormat: 'carousel',
      creativeSpec: {
        primaryText: 'Carousel copy',
        cards: [
          {
            imageHash: 'image-1',
            headline: 'Card one',
            destinationUrl: 'https://example.com/one',
          },
          {
            videoId: 'video-2',
            headline: 'Card two',
            destinationUrl: 'https://example.com/two',
          },
        ],
      },
    },
    {
      creativeFormat: 'catalog',
      creativeSpec: { productSetId: 'set-1', primaryText: 'Catalog copy' },
    },
    {
      creativeFormat: 'collection',
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverImageHash: 'image-1',
        primaryText: 'Collection copy',
      },
    },
    {
      creativeFormat: 'flexible',
      creativeSpec: {
        primaryText: 'Flexible copy',
        primaryTexts: ['Flexible copy', 'Alternate copy'],
        imageHashes: ['image-1'],
        videoIds: ['video-1'],
        headlines: ['Headline one'],
        descriptions: ['Description one'],
        destinationUrl: 'https://example.com/flexible',
      },
    },
    {
      creativeFormat: 'placement_image',
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Placement copy',
        headline: 'Placement headline',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      },
    },
    {
      creativeFormat: 'placement_customized_ctwa',
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'CTWA placement copy',
        headline: 'CTWA headline',
        destinationUrl: 'https://api.whatsapp.com/send',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      },
    },
    {
      creativeFormat: 'existing_post',
      creativeSpec: { objectStoryId: 'page-1_post-1' },
    },
  ];

  it.each(canonicalCreativeCases)(
    'strictly parses $creativeFormat as a canonical creative option',
    async ({ creativeFormat, creativeSpec }) => {
      let receivedOptions: Record<string, unknown> | undefined;
      const adapter = new MetaAdsAdapter({
        clientFactory: (config) => ({ config }) as never,
        tools: {
          createAdCreative: async (_client, options) => {
            receivedOptions = options as unknown as Record<string, unknown>;
            return {
              operation: 'create_adcreative',
              status: 'dry_run',
              executed: false,
              preview: {},
            };
          },
        },
      });

      const response = await adapter.createAdCreative({
        provider: 'meta',
        accountId: 'act_123',
        params: {
          name: `${creativeFormat} creative`,
          ...(creativeFormat === 'existing_post' ? {} : { pageId: 'page-1' }),
          mode: 'standard',
          creativeFormat,
          creativeSpec,
          collaborativeProductSetId: 'set-1',
          collaborativeAppSpec: {
            applicationId: 'app-1',
            android: { appName: 'Retailer', packageName: 'com.retailer.app' },
          },
        },
        credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
      });

      expect(response.ok).toBe(true);
      expect(receivedOptions).toMatchObject({
        mode: 'standard',
        collaborativeProductSetId: 'set-1',
        collaborativeAppSpec: {
          applicationId: 'app-1',
          android: { appName: 'Retailer', packageName: 'com.retailer.app' },
        },
        creative: { creativeFormat, creativeSpec },
      });
      expect(receivedOptions).not.toHaveProperty('creativeFormat');
      expect(receivedOptions).not.toHaveProperty('creativeSpec');
    }
  );

  it('threads a video creativeSpec.applinkTreatment override through parsing into the dry-run omnichannel preview', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Video omnichannel creative',
        pageId: 'page-1',
        mode: 'standard',
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          thumbnailImageHash: 'thumb-1',
          primaryText: 'Video copy',
          destinationUrl: 'https://example.com/video',
          applinkTreatment: 'deeplink_with_appstore_fallback',
        },
        collaborativeAppSpec: {
          applicationId: '957549474255294',
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    const preview = response.ok ? (response.data?.preview as Record<string, unknown>) : undefined;
    expect(preview?.applink_treatment).toBe('deeplink_with_appstore_fallback');
    expect(preview?.omnichannel_link_spec).toEqual(expect.any(Object));
  });

  it('threads existing_post creativeSpec.destinationUrl through parsing into the dry-run omnichannel preview', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Existing post omnichannel creative',
        creativeFormat: 'existing_post',
        creativeSpec: {
          objectStoryId: '123_456',
          destinationUrl: 'https://s.shopee.co.id/product',
        },
        collaborativeAppSpec: {
          applicationId: '957549474255294',
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    const preview = response.ok ? (response.data?.preview as Record<string, unknown>) : undefined;
    expect(preview?.object_story_id).toBe('123_456');
    expect(preview?.applink_treatment).toBe('automatic');
    expect(preview?.omnichannel_link_spec).toMatchObject({
      web: { url: 'https://s.shopee.co.id/product' },
    });
  });

  it('attaches image and video creatives to separate ads in the same ad set', async () => {
    const adCreateCalls: Array<{ adsetId: string; creativeId: string }> = [];
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async (_client, options) => {
          const format = options.creative?.creativeFormat;
          const id = format === 'single_image' ? 'creative-image' : 'creative-video';
          return {
            operation: 'create_adcreative',
            status: 'executed',
            executed: true,
            id,
            preview: {},
          };
        },
        createAd: async (_client, options) => {
          adCreateCalls.push({ adsetId: options.adSetId, creativeId: options.creativeId });
          return {
            operation: 'create_ad',
            status: 'executed',
            executed: true,
            id: `ad-${options.creativeId}`,
            preview: {},
          };
        },
      },
    });
    const credentials = {
      provider: 'meta' as const,
      accessToken: 'workflow-credential',
      source: 'test',
    };

    const imageCreative = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Image creative',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Image copy',
          destinationUrl: 'https://example.com/image',
        },
        dryRun: false,
        confirmed: true,
      },
      credentials,
    });
    const videoCreative = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Video creative',
        pageId: 'page-1',
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          primaryText: 'Video copy',
          destinationUrl: 'https://example.com/video',
        },
        dryRun: false,
        confirmed: true,
      },
      credentials,
    });

    for (const [name, creativeId] of [
      ['Image ad', imageCreative.data?.id],
      ['Video ad', videoCreative.data?.id],
    ] as const) {
      expect(creativeId).toBeDefined();
      await adapter.createAd({
        provider: 'meta',
        accountId: 'act_123',
        params: {
          name,
          adSetId: 'adset-1',
          creativeId,
          dryRun: false,
          confirmed: true,
        },
        credentials,
      });
    }

    expect(adCreateCalls).toEqual([
      expect.objectContaining({ adsetId: 'adset-1', creativeId: 'creative-image' }),
      expect.objectContaining({ adsetId: 'adset-1', creativeId: 'creative-video' }),
    ]);
  });

  it('preserves completed IDs when the legacy bundle reports a later partial failure', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createEcommerceCampaignBundle: async () => ({
          operation: 'create_ecommerce_campaign_bundle',
          status: 'failed',
          executed: false,
          preview: { campaign: {}, adSet: {}, creative: {}, ad: {} },
          ids: { campaignId: 'campaign-1', adSetId: 'adset-1', creativeId: 'creative-1' },
          error: 'Ad creation failed.',
          warnings: [],
        }),
      },
    });

    const response = await adapter.createEcommerceCampaignBundle({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        campaignName: 'Campaign',
        adSetName: 'Ad set',
        adName: 'Ad',
        pageId: 'page-1',
        pixelId: 'pixel-1',
        destinationUrl: 'https://example.com',
        dailyBudget: 100_000,
        countries: ['ID'],
        primaryText: 'Copy',
        headline: 'Headline',
        imageHash: 'image-1',
        dryRun: false,
        confirmed: true,
      },
      credentials: {
        provider: 'meta',
        accessToken: 'partial-workflow-credential',
        source: 'test',
      },
    });

    expect(response.ok).toBe(false);
    expect(response.data?.ids).toEqual({
      campaignId: 'campaign-1',
      adSetId: 'adset-1',
      creativeId: 'creative-1',
    });
  });

  it.each([
    {
      name: 'invalid mode',
      operation: 'campaign',
      params: { name: 'Campaign', objective: 'OUTCOME_SALES', mode: 'invalid-mode' },
    },
    {
      name: 'non-object collaborativeCatalog',
      operation: 'adset',
      params: { campaignId: 'campaign-1', name: 'Ad set', collaborativeCatalog: [] },
    },
    {
      name: 'invalid creative format',
      operation: 'creative',
      params: {
        name: 'Creative',
        pageId: 'page-1',
        creativeFormat: 'invalid-format',
        creativeSpec: {},
      },
    },
    {
      name: 'non-object creativeSpec',
      operation: 'creative',
      params: {
        name: 'Creative',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: 'not-an-object',
      },
    },
    {
      name: 'malformed carousel cards',
      operation: 'creative',
      params: {
        name: 'Creative',
        pageId: 'page-1',
        creativeFormat: 'carousel',
        creativeSpec: { primaryText: 'Copy', cards: 'not-an-array' },
      },
    },
    {
      name: 'malformed scalar creative field',
      operation: 'creative',
      params: {
        name: 'Creative',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 123,
          primaryText: 'Copy',
          destinationUrl: 'https://example.com',
        },
      },
    },
  ])('rejects $name before calling a create tool', async ({ operation, params }) => {
    let createCalls = 0;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createCampaign: async () => {
          createCalls += 1;
          return {
            operation: 'create_campaign',
            status: 'dry_run',
            executed: false,
            preview: {},
            mode: 'standard',
          };
        },
        createAdSet: async () => {
          createCalls += 1;
          return { operation: 'create_adset', status: 'dry_run', executed: false, preview: {} };
        },
        createAdCreative: async () => {
          createCalls += 1;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });
    const request = {
      provider: 'meta' as const,
      accountId: 'act_123',
      params,
      credentials: {
        provider: 'meta' as const,
        accessToken: 'malformed-input-credential',
        source: 'test',
      },
    };

    const response =
      operation === 'campaign'
        ? await adapter.createCampaign(request)
        : operation === 'adset'
          ? await adapter.createAdSet(request)
          : await adapter.createAdCreative(request);

    expect(response).toMatchObject({
      ok: false,
      errors: [{ provider: 'meta', code: 'VALIDATION_ERROR' }],
    });
    expect(createCalls).toBe(0);
  });

  it('rejects a creativeFormat/creativeSpec pair mixed with legacy top-level fields instead of silently dropping them', async () => {
    // Regression: this combination used to succeed with the canonical
    // creativeSpec silently winning and the legacy link/message fields
    // silently discarded — easy to mistake for "both were merged". It's now
    // rejected up front with a clear error naming the ignored fields.
    let createCalls = 0;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async () => {
          createCalls += 1;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Ambiguous mix',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'canonical-image',
          primaryText: 'Canonical copy',
          destinationUrl: 'https://example.com/canonical',
        },
        link: 'https://example.com/legacy',
        message: 'Legacy copy',
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(false);
    expect(response.errors).toMatchObject([{ provider: 'meta', code: 'VALIDATION_ERROR' }]);
    expect(response.errors?.[0]?.message).toMatch(/link, message/);
    expect(createCalls).toBe(0);
  });

  it('accepts creativeFormat/creativeSpec alone without tripping the legacy-field ambiguity check', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Canonical only',
        pageId: 'page-1',
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'canonical-image',
          primaryText: 'Canonical copy',
          destinationUrl: 'https://example.com/canonical',
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: { imageHash: 'canonical-image', primaryText: 'Canonical copy' },
      },
    });
    expect(receivedOptions?.linkData).toBeUndefined();
  });

  it('preserves creativeSpec.messageExtensions for canonical asset_feed_spec creatives', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Placement CTWA',
        pageId: 'page-1',
        creativeFormat: 'placement_image',
        creativeSpec: {
          feedImageHash: 'feed-image',
          verticalImageHash: 'vertical-image',
          primaryText: 'Chat via WhatsApp',
          headline: 'Tanya stok',
          destinationUrl: 'https://api.whatsapp.com/send',
          callToAction: 'WHATSAPP_MESSAGE',
          messageExtensions: [{ type: 'whatsapp' }],
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({
      creative: {
        creativeFormat: 'placement_image',
        creativeSpec: {
          messageExtensions: [{ type: 'whatsapp' }],
        },
      },
    });
  });

  it('falls back to objectStorySpec.page_id when top-level pageId is omitted', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Dynamic Creative',
        objectStorySpec: { page_id: 'page-from-object-story-spec' },
        assetFeedSpec: {
          bodies: [{ text: 'Primary text' }],
          titles: [{ text: 'Headline' }],
          link_urls: [{ website_url: 'https://example.com' }],
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(receivedOptions).toMatchObject({ pageId: 'page-from-object-story-spec' });
  });

  it('still rejects when neither top-level pageId nor objectStorySpec.page_id is given', async () => {
    let createCalls = 0;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async () => {
          createCalls += 1;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Dynamic Creative',
        objectStorySpec: {},
        assetFeedSpec: {
          bodies: [{ text: 'Primary text' }],
          titles: [{ text: 'Headline' }],
          link_urls: [{ website_url: 'https://example.com' }],
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(false);
    expect(response.errors).toMatchObject([{ provider: 'meta', code: 'VALIDATION_ERROR' }]);
    expect(createCalls).toBe(0);
  });

  it('exposes structured local validation errors without posting to Meta', async () => {
    let postCalls = 0;
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaPost: async () => {
            postCalls += 1;
            return { id: 'unexpected-creative' };
          },
        }) as never,
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Mismatched catalog creative',
        pageId: 'page-1',
        mode: 'collaborative_ads',
        creativeFormat: 'catalog',
        creativeSpec: {
          productSetId: 'creative-set',
          primaryText: 'Catalog copy',
          destinationUrl: 'https://example.com/catalog',
        },
        collaborativeProductSetId: 'adset-set',
        dryRun: false,
        confirmed: true,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(false);
    expect(response.data?.structuredError).toMatchObject({
      provider: 'meta',
      code: 'VALIDATION_ERROR',
      message: 'Product set creative dan ad set harus sama.',
    });
    expect(postCalls).toBe(0);
  });

  it('does not expose nested signed creative read-back URLs at the adapter response boundary', async () => {
    const signedUrl =
      'https://cdn.example.test/private/adapter-creative.jpg?X-Amz-Signature=adapter-boundary-secret&expires=60';
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaPost: async () => ({ id: 'creative-adapter-safe' }),
          metaGetObject: async () => ({
            id: 'creative-adapter-safe',
            product_set_id: 'set-1',
            object_story_spec: {
              template_data: { image_url: signedUrl },
            },
            asset_feed_spec: {
              images: [{ url: signedUrl }],
            },
          }),
        }) as never,
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Safe adapter catalog',
        pageId: 'page-1',
        creativeFormat: 'catalog',
        creativeSpec: {
          productSetId: 'set-1',
          primaryText: 'Catalog copy',
          destinationUrl: 'https://example.com/catalog',
        },
        dryRun: false,
        confirmed: true,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });
    const serialized = JSON.stringify(response);

    expect(response.ok).toBe(true);
    expect(response.data?.verification).toMatchObject({
      creativeId: 'creative-adapter-safe',
      summary: {
        productSetId: 'set-1',
        hasObjectStorySpec: true,
        hasTemplateData: true,
        hasAssetFeedSpec: true,
      },
    });
    expect(response.data?.verification).not.toHaveProperty('fields');
    expect(serialized).not.toContain(signedUrl);
    expect(serialized).not.toContain('adapter-boundary-secret');
  });

  it.each([
    { creativeFormat: 'single_image' },
    {
      creativeSpec: {
        imageHash: 'image-1',
        primaryText: 'Copy',
        destinationUrl: 'https://example.com',
      },
    },
  ])(
    'rejects an incomplete canonical creative pair before calling the tool: %o',
    async (params) => {
      let calls = 0;
      const adapter = new MetaAdsAdapter({
        clientFactory: (config) => ({ config }) as never,
        tools: {
          createAdCreative: async () => {
            calls += 1;
            return {
              operation: 'create_adcreative',
              status: 'dry_run',
              executed: false,
              preview: {},
            };
          },
        },
      });

      const response = await adapter.createAdCreative({
        provider: 'meta',
        accountId: 'act_123',
        params: {
          name: 'Incomplete canonical pair',
          pageId: 'page-1',
          link: 'https://example.com/legacy',
          message: 'Legacy copy',
          ...params,
        },
        credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
      });

      expect(response).toMatchObject({
        ok: false,
        errors: [{ provider: 'meta', code: 'VALIDATION_ERROR' }],
      });
      expect(calls).toBe(0);
    }
  );

  it('rejects malformed canonical array fields before calling the creative tool', async () => {
    let calls = 0;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        createAdCreative: async () => {
          calls += 1;
          return {
            operation: 'create_adcreative',
            status: 'dry_run',
            executed: false,
            preview: {},
          };
        },
      },
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Malformed flexible creative',
        pageId: 'page-1',
        creativeFormat: 'flexible',
        creativeSpec: {
          primaryText: 'Copy',
          primaryTexts: ['Copy'],
          imageHashes: ['image-1', 2],
          destinationUrl: 'https://example.com',
        },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response).toMatchObject({
      ok: false,
      errors: [{ provider: 'meta', code: 'VALIDATION_ERROR' }],
    });
    expect(calls).toBe(0);
  });

  it('explains that official assetFeedSpec requires objectStorySpec', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
    });

    const response = await adapter.createAdCreative({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        name: 'Incomplete Dynamic Creative',
        pageId: 'page_123',
        assetFeedSpec: { ad_formats: ['AUTOMATIC_FORMAT'] },
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.errors?.[0]).toMatchObject({
      code: 'INVALID_DYNAMIC_CREATIVE_PAYLOAD',
      message: expect.stringContaining('objectStorySpec'),
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

  it('passes custom audiences and excluded custom audiences into ad set targeting', async () => {
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
        name: 'Retargeting Ad Set',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        geoLocations: { countries: ['ID'] },
        ageMin: 18,
        ageMax: 65,
        customAudiences: [{ id: 'aud_1' }, { id: 'aud_2' }],
        excludedCustomAudiences: [{ id: 'aud_excl' }],
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    const targeting = receivedOptions?.targeting as Record<string, unknown>;
    expect(targeting.customAudiences).toEqual([{ id: 'aud_1' }, { id: 'aud_2' }]);
    expect(targeting.excludedCustomAudiences).toEqual([{ id: 'aud_excl' }]);
  });

  it('forwards advantageAudience shorthand into targeting_automation', async () => {
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
        name: 'Advantage Audience Ad Set',
        ageMin: 25,
        ageMax: 65,
        genders: [2],
        advantageAudience: 1,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    const targeting = receivedOptions?.targeting as Record<string, unknown>;
    expect(targeting.targetingAutomation).toEqual({ advantage_audience: 1 });
  });

  it('forwards granular Instagram/Threads/device placements into ad set targeting', async () => {
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
        name: 'Granular Placement Ad Set',
        publisherPlatforms: ['instagram', 'threads'],
        instagramPositions: ['stream', 'story', 'explore', 'reels', 'profile_feed'],
        threadsPositions: ['threads_stream'],
        devicePlatforms: ['mobile'],
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    const targeting = receivedOptions?.targeting as Record<string, unknown>;
    expect(targeting.instagramPositions).toEqual([
      'stream',
      'story',
      'explore',
      'reels',
      'profile_feed',
    ]);
    expect(targeting.threadsPositions).toEqual(['threads_stream']);
    expect(targeting.devicePlatforms).toEqual(['mobile']);
  });

  it('clones an ad set, passing source id and overrides to the tool', async () => {
    let received: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        cloneAdSet: async (_client, options) => {
          received = options as unknown as Record<string, unknown>;
          return {
            operation: 'clone_adset',
            status: 'dry_run',
            executed: false,
            sourceAdSetId: 'as_src',
            preview: {},
          };
        },
      },
    });

    const response = await adapter.cloneAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: { sourceAdSetId: 'as_src', name: 'Clone', startTime: '2026-07-20T01:00:00+0700' },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(response.ok).toBe(true);
    expect(received?.adAccountId).toBe('act_123');
    expect(received?.sourceAdSetId).toBe('as_src');
    expect(received?.name).toBe('Clone');
    expect(received?.startTime).toBe('2026-07-20T01:00:00+0700');
  });

  it('errors when cloneAdSet has no sourceAdSetId', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        cloneAdSet: async () => ({
          operation: 'clone_adset',
          status: 'dry_run',
          executed: false,
          sourceAdSetId: '',
          preview: {},
        }),
      },
    });
    const response = await adapter.cloneAdSet({
      provider: 'meta',
      accountId: 'act_1',
      params: {},
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);
    expect(response.ok).toBe(false);
  });

  it('resumes an ad by adId', async () => {
    let receivedId: string | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        resumeAd: async (_client, adId) => {
          receivedId = adId;
          return { success: true, id: adId, operation: 'resume', entityType: 'ad', response: {} };
        },
      },
    });

    const response = await adapter.resumeAd({
      provider: 'meta',
      accountId: 'act_123',
      params: { adId: 'ad_1' },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(response.ok).toBe(true);
    expect(receivedId).toBe('ad_1');
  });

  it('pauses an ad set by adSetId', async () => {
    let receivedId: string | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        pauseAdSet: async (_client, adSetId) => {
          receivedId = adSetId;
          return {
            success: true,
            id: adSetId,
            operation: 'pause',
            entityType: 'adset',
            response: {},
          };
        },
      },
    });

    const response = await adapter.pauseAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: { adSetId: 'adset_1' },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(response.ok).toBe(true);
    expect(receivedId).toBe('adset_1');
  });

  it('resumes an ad set by adSetId', async () => {
    let receivedId: string | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        resumeAdSet: async (_client, adSetId) => {
          receivedId = adSetId;
          return {
            success: true,
            id: adSetId,
            operation: 'resume',
            entityType: 'adset',
            response: {},
          };
        },
      },
    });

    const response = await adapter.resumeAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: { adSetId: 'adset_1' },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(response.ok).toBe(true);
    expect(receivedId).toBe('adset_1');
  });

  it('accepts the adsetId alias (lowercase set) for pauseAdSet/resumeAdSet', async () => {
    let pausedId: string | undefined;
    let resumedId: string | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        pauseAdSet: async (_client, adSetId) => {
          pausedId = adSetId;
          return {
            success: true,
            id: adSetId,
            operation: 'pause',
            entityType: 'adset',
            response: {},
          };
        },
        resumeAdSet: async (_client, adSetId) => {
          resumedId = adSetId;
          return {
            success: true,
            id: adSetId,
            operation: 'resume',
            entityType: 'adset',
            response: {},
          };
        },
      },
    });

    await adapter.pauseAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: { adsetId: 'adset_2' },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);
    await adapter.resumeAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: { adsetId: 'adset_2' },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(pausedId).toBe('adset_2');
    expect(resumedId).toBe('adset_2');
  });

  it('errors when pauseAdSet/resumeAdSet have no adSetId', async () => {
    const adapter = new MetaAdsAdapter({ clientFactory: (config) => ({ config }) as never });

    const pauseResponse = await adapter.pauseAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: {},
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);
    const resumeResponse = await adapter.resumeAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: {},
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(pauseResponse.ok).toBe(false);
    expect(pauseResponse.errors).toMatchObject([{ code: 'MISSING_ADSET_ID' }]);
    expect(resumeResponse.ok).toBe(false);
    expect(resumeResponse.errors).toMatchObject([{ code: 'MISSING_ADSET_ID' }]);
  });

  it('passes startTime and endTime into ad set updates', async () => {
    let receivedOptions: Record<string, unknown> | undefined;
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        updateAdSet: async (_client, options) => {
          receivedOptions = options as unknown as Record<string, unknown>;
          return { operation: 'update_adset', status: 'executed', preview: {}, mode: 'patch' };
        },
      },
    });

    const response = await adapter.updateAdSet({
      provider: 'meta',
      accountId: 'act_123',
      params: {
        adSetId: 'as_1',
        status: 'ACTIVE',
        startTime: '2026-07-20T01:00:00+0700',
        endTime: '2026-07-27T23:59:00+0700',
        dryRun: false,
        confirmed: true,
      },
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    } as never);

    expect(response.ok).toBe(true);
    expect(receivedOptions?.startTime).toBe('2026-07-20T01:00:00+0700');
    expect(receivedOptions?.endTime).toBe('2026-07-27T23:59:00+0700');
  });

  it('lists Meta pages without exposing page access tokens', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: (config) => ({ config }) as never,
      tools: {
        listPages: async () => [
          {
            id: 'page_123',
            name: 'Affiliate Page',
            category: 'Shopping',
            tasks: ['ADVERTISE', 'CREATE_CONTENT'],
            access_token: 'page-token-secret',
          },
        ],
      },
    });

    const response = await adapter.listPages({
      provider: 'meta',
      params: {},
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual([
      {
        id: 'page_123',
        name: 'Affiliate Page',
        category: 'Shopping',
        tasks: ['ADVERTISE', 'CREATE_CONTENT'],
        can_advertise: true,
      },
    ]);
    expect(JSON.stringify(response)).not.toContain('page-token-secret');
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

  it('reads a single Meta ad set with full fields via readAdSetFull', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGetObject: async (_path: string, params: Record<string, unknown>) => {
            const fields = String(params.fields ?? '');
            if (fields.includes('targeting')) {
              return {
                targeting: { age_min: 18, custom_audiences: [{ id: 'ca_1', name: '30D' }] },
              };
            }
            return { id: 'as_1', name: 'Set A', status: 'PAUSED', campaign_id: 'c_1' };
          },
        }) as never,
    });

    const response = await adapter.readAdSetFull({
      provider: 'meta',
      accountId: 'act_123',
      params: { adsetId: 'as_1' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.mode).toBe('single');
    expect(response.data?.adset_id).toBe('as_1');
    expect(response.data?.adset?.name).toBe('Set A');
    expect(response.data?.fields_retrieved).toContain('targeting');
  });

  it('lists Meta ad sets for a campaign via readAdSetFull', async () => {
    const adapter = new MetaAdsAdapter({
      clientFactory: () =>
        ({
          metaGet: async () => ({
            data: [
              { id: 'as_1', name: 'Set A' },
              { id: 'as_2', name: 'Set B' },
            ],
            paging: { cursors: { after: 'CUR' } },
          }),
        }) as never,
    });

    const response = await adapter.readAdSetFull({
      provider: 'meta',
      accountId: 'act_123',
      params: { campaignId: 'c_1' },
      credentials: {
        provider: 'meta',
        accessToken: 'secret-token',
        accountId: 'act_123',
        source: 'test',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.data?.mode).toBe('list');
    expect(response.data?.adsets).toHaveLength(2);
    expect(response.data?.next_cursor).toBe('CUR');
  });

  it('errors when readAdSetFull is called without adsetId, campaignId, or accountId', async () => {
    const adapter = new MetaAdsAdapter();

    const response = await adapter.readAdSetFull({
      provider: 'meta',
      params: {},
      credentials: { provider: 'meta', accessToken: 'secret-token', source: 'test' },
    });

    expect(response.ok).toBe(false);
  });
});
