import { describe, expect, it, vi } from 'vitest';
import { createCpasCatalogCampaignBundle } from '../src/tools/createCpasCatalogCampaignBundle.js';
import type { MetaClient } from '../src/metaClient.js';
import type { CpasCatalogCampaignBundlePayload } from '../src/tools/createCpasCatalogCampaignBundle.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    metaGetObject: vi.fn().mockResolvedValue({
      id: 'ps_1',
      name: 'CPAS Product Set',
      product_catalog: 'catalog_1',
      product_count: 12,
    }),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

function mockSafeResumeReads(client: MetaClient): void {
  (client.metaGetObject as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
    if (path === '/ps_1') return { id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 };
    if (path === '/campaign_existing')
      return {
        id: 'campaign_existing',
        account_id: '123',
        name: 'CPAS Catalog Sales',
        status: 'PAUSED',
        objective: 'OUTCOME_SALES',
        daily_budget: '150000',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        promoted_object: { product_catalog_id: 'catalog_1' },
      };
    if (path === '/adset_existing')
      return {
        id: 'adset_existing',
        account_id: '123',
        name: 'Indonesia Purchase',
        campaign_id: 'campaign_existing',
        status: 'PAUSED',
        destination_type: 'UNDEFINED',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        billing_event: 'IMPRESSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: { geo_locations: { countries: ['ID'] }, age_min: 18 },
        promoted_object: { product_set_id: 'ps_1' },
      };
    if (path === '/creative_existing')
      return {
        id: 'creative_existing',
        account_id: '123',
        product_set_id: 'ps_1',
        status: 'PAUSED',
        object_story_spec: {
          page_id: 'page_1',
          template_data: {
            message: 'Temukan produk pilihan untukmu.',
            name: 'Belanja sekarang',
            link: 'https://shopee.co.id',
            call_to_action: { type: 'SHOP_NOW' },
          },
        },
      };
    if (path === '/ad_existing')
      return {
        id: 'ad_existing',
        account_id: '123',
        name: 'Catalog Dynamic',
        campaign_id: 'campaign_existing',
        adset_id: 'adset_existing',
        status: 'PAUSED',
        creative: { id: 'creative_existing' },
      };
    return {};
  });
}

const payload = {
  adAccountId: 'act_123',
  campaignName: 'CPAS Catalog Sales',
  adSetName: 'Indonesia Purchase',
  adName: 'Catalog Dynamic',
  pageId: 'page_1',
  productSetId: 'ps_1',
  pixelId: 'pixel_1',
  dailyBudget: 150000,
  countries: ['ID'],
  primaryText: 'Temukan produk pilihan untukmu.',
  headline: 'Belanja sekarang',
  destinationUrl: 'https://shopee.co.id',
};

describe('createCpasCatalogCampaignBundle', () => {
  it('returns a catalog dry-run preview without calling Meta POST', async () => {
    const client = createMockClient();

    const result = await createCpasCatalogCampaignBundle(client, payload);

    expect(result).toMatchObject({ status: 'dry_run', executed: false });
    expect(client.metaPost).not.toHaveBeenCalled();
    expect(result.preview.campaign).toMatchObject({
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: {
        product_catalog_id: 'catalog_1',
        smart_pse_enabled: false,
      },
    });
    expect(result.preview.adSet).toMatchObject({
      destination_type: 'UNDEFINED',
      promoted_object: {
        product_set_id: 'ps_1',
        custom_event_type: 'PURCHASE',
        variation: 'PRODUCT_SET_AND_OMNICHANNEL',
        smart_pse_enabled: false,
      },
    });
    expect(result.preview.adSet.promoted_object).not.toHaveProperty('omnichannel_object');
    expect(result.preview.adSet.promoted_object).not.toHaveProperty('product_catalog_id');
    expect(result.preview.adSet.destination_type).toBe('UNDEFINED');
    expect(result.preview.creative).toMatchObject({
      product_set_id: 'ps_1',
      object_story_spec: { template_data: expect.any(Object) },
    });
    expect(result.preview.creative).not.toHaveProperty('omnichannel_link_spec');
    expect(result.preview.ad).toMatchObject({ status: 'PAUSED' });
  });

  it('uses destinationUrl and omits unsupported template_url for catalog single-image', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      creativeFormat: 'catalog_single_image',
      destinationUrl: 'https://example.com/destination',
      templateUrl: 'https://example.com/legacy-template',
    });

    const objectStorySpec = result.preview.creative.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(templateData.link).toBe('https://example.com/destination');
    expect(templateData).not.toHaveProperty('template_url');
  });

  it('applies typed campaign, ad set, and catalog creative settings to the dry-run preview', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      campaignSettings: {
        specialAdCategories: ['EMPLOYMENT'],
        buyType: 'AUCTION',
        isAdSetBudgetSharingEnabled: false,
      },
      adSetSettings: {
        bidStrategy: 'COST_CAP',
        bidAmount: 1250,
        bidConstraints: { roas_average_floor: 20000 },
        startTime: '2026-10-01T00:00:00+07:00',
        endTime: '2026-10-15T23:59:59+07:00',
        attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
        customAudiences: [{ id: 'audience-1' }],
        excludedCustomAudiences: [{ id: 'audience-2' }],
        advantageAudience: 1,
        facebookPositions: ['feed'],
        instagramPositions: ['stream', 'story'],
        dsaBeneficiary: 'Brand PT',
        dsaPayor: 'Agency PT',
        multiAdvertiserAds: 0,
      },
      creativeSettings: {
        showMultipleImages: true,
        preferredImageTags: ['front', 'lifestyle'],
        categorizationCriteria: 'product_type',
        urlTags: 'utm_source=meta&utm_campaign=cpas',
        optOutEnhancements: ['media_type_automation'],
      },
    });

    expect(result.preview.campaign).toMatchObject({
      special_ad_categories: ['EMPLOYMENT'],
      buying_type: 'AUCTION',
      is_adset_budget_sharing_enabled: false,
    });
    expect(result.preview.adSet).toMatchObject({
      bid_amount: 1250,
      bid_strategy: 'COST_CAP',
      bid_constraints: { roas_average_floor: 20000 },
      start_time: '2026-10-01T00:00:00+07:00',
      end_time: '2026-10-15T23:59:59+07:00',
      attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
      dsa_beneficiary: 'Brand PT',
      dsa_payor: 'Agency PT',
      multi_advertiser_ads: 0,
      targeting: {
        custom_audiences: [{ id: 'audience-1' }],
        excluded_custom_audiences: [{ id: 'audience-2' }],
        facebook_positions: ['feed'],
        instagram_positions: ['stream', 'story'],
        targeting_automation: { advantage_audience: 1 },
      },
    });
    expect(result.preview.creative).toMatchObject({
      categorization_criteria: 'product_type',
      url_tags: 'utm_source=meta&utm_campaign=cpas',
      degrees_of_freedom_spec: {
        creative_features_spec: {
          media_type_automation: { enroll_status: 'OPT_OUT' },
        },
      },
      object_story_spec: {
        template_data: {
          show_multiple_images: true,
          multi_share_end_card: false,
          preferred_image_tags: ['front', 'lifestyle'],
        },
      },
    });
  });

  it('rejects mutually exclusive catalog image and format automation settings', async () => {
    const result = await createCpasCatalogCampaignBundle(createMockClient(), {
      ...payload,
      creativeSettings: {
        showMultipleImages: true,
        formatOption: 'carousel_slideshows',
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      executed: false,
      stage: 'preflight',
      code: 'INVALID_CPAS_CATALOG_CREATIVE_SETTINGS',
    });
    expect(result.error).toMatch(/showMultipleImages.*formatOption/i);
  });

  it('rejects a manually selected fallback image for a dynamic catalog creative', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      creativeFormat: 'catalog_single_image',
      fallbackImageHash: 'manual-image-hash',
    });

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'UNSUPPORTED_CPAS_CATALOG_FALLBACK_IMAGE',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it.each([
    ['formatOption', 'not_a_meta_format'],
    ['categorizationCriteria', 'not_a_category'],
  ])('rejects unsupported bundle %s before POST', async (field, value) => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        creativeSettings: { [field]: value },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'INVALID_CPAS_CATALOG_CREATIVE_SETTINGS',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('warns when category eligibility must be confirmed by Meta', async () => {
    const result = await createCpasCatalogCampaignBundle(createMockClient(), {
      ...payload,
      creativeSettings: { categorizationCriteria: 'category' },
    });
    expect(result.warnings.join(' ')).toMatch(/kategori.*Meta/i);
  });

  it('requires an app platform spec before creating omnichannel parent objects', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      destinationMode: 'app_omnichannel',
      collaborativeAppSpec: { applicationId: 'app-1' },
      objectStoreUrls: ['https://play.google.com/store/apps/details?id=com.shop.app'],
    });

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'MISSING_CPAS_OMNICHANNEL_PLATFORM',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('lets showMultipleImages override the single-image presentation defaults in preview', async () => {
    const result = await createCpasCatalogCampaignBundle(createMockClient(), {
      ...payload,
      creativeFormat: 'catalog_single_image',
      creativeSettings: { showMultipleImages: true },
    });

    expect(result.preview.creative).toMatchObject({
      object_story_spec: {
        template_data: {
          show_multiple_images: true,
          multi_share_end_card: false,
          force_single_link: false,
        },
      },
    });
  });

  it('shows the selected Instagram identity in the dry-run preview', async () => {
    const client = createMockClient();

    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      instagramUserId: 'ig_1',
    });

    expect(result.preview.creative.object_story_spec).toMatchObject({
      instagram_user_id: 'ig_1',
    });
  });

  it('shows the selected Threads identity in the dry-run preview of every creative variant', async () => {
    // The executor passes threadsProfileId into createAdCreative, so a preview
    // without threads_user_id lies about what execution will send.
    const variants: CpasCatalogCampaignBundlePayload[] = [
      { ...payload, threadsProfileId: 'threads_1' } as CpasCatalogCampaignBundlePayload,
      {
        ...payload,
        threadsProfileId: 'threads_1',
        creativeFormat: 'collection',
        collection: { instantExperienceId: 'canvas_1', coverImageHash: 'cover_1' },
      } as unknown as CpasCatalogCampaignBundlePayload,
      {
        ...payload,
        threadsProfileId: 'threads_1',
        creativeFormat: 'catalog_video',
        video: { videoId: 'video_1', instantExperienceId: 'canvas_1', retailerAppId: 'app_1' },
      } as unknown as CpasCatalogCampaignBundlePayload,
    ];

    for (const variant of variants) {
      const result = await createCpasCatalogCampaignBundle(createMockClient(), variant);

      expect(result.preview.creative.object_story_spec).toMatchObject({
        threads_user_id: 'threads_1',
      });
    }
  });

  it('builds a CPAS Collection creative from an Instant Experience and one cover image', async () => {
    const client = createMockClient();
    const collectionPayload = {
      ...payload,
      creativeFormat: 'collection',
      collection: {
        instantExperienceId: 'canvas_1',
        coverImageHash: 'cover_1',
      },
    } as unknown as CpasCatalogCampaignBundlePayload;

    const result = await createCpasCatalogCampaignBundle(client, collectionPayload);

    expect(result.preview.creative).toMatchObject({
      object_story_spec: {
        link_data: {
          image_hash: 'cover_1',
          link: 'https://fb.com/canvas_doc/canvas_1',
        },
      },
    });
    expect(result.preview.creative).not.toHaveProperty('product_set_id');
  });

  it('omits product_set_id from the created CPAS Collection creative', async () => {
    const client = createMockClient();
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post
      .mockResolvedValueOnce({ id: 'campaign_1' })
      .mockResolvedValueOnce({ id: 'adset_1' })
      .mockResolvedValueOnce({ id: 'creative_1' })
      .mockResolvedValueOnce({ id: 'ad_1' });
    (client.metaGetObject as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'campaign_1', objective: 'OUTCOME_SALES' });

    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        creativeFormat: 'collection',
        collection: { instantExperienceId: 'canvas_1', coverImageHash: 'cover_1' },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result.status, result.error).toBe('executed');
    const creativePayload = post.mock.calls[2][1] as Record<string, unknown>;
    expect(creativePayload).not.toHaveProperty('product_set_id');
    expect(creativePayload).toHaveProperty('object_story_spec');
  });

  it('builds a catalog single-image template without a manually supplied image', async () => {
    const client = createMockClient();

    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      creativeFormat: 'catalog_single_image',
    });

    const objectStorySpec = result.preview.creative.object_story_spec as Record<string, unknown>;
    const templateData = objectStorySpec.template_data as Record<string, unknown>;
    expect(result.preview.creative).toMatchObject({ product_set_id: 'ps_1' });
    expect(templateData).toMatchObject({
      multi_share_end_card: true,
      show_multiple_images: false,
      force_single_link: true,
    });
    expect(templateData).not.toHaveProperty('image_hash');
    expect(result.preview.creative).not.toHaveProperty('omnichannel_link_spec');
  });

  it('builds a catalog carousel template without manual child attachments', async () => {
    const client = createMockClient();

    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      creativeFormat: 'catalog_carousel',
    });

    expect(result.preview.creative).toMatchObject({
      product_set_id: 'ps_1',
      asset_feed_spec: {
        bodies: [{ text: payload.primaryText }],
        ad_formats: ['CAROUSEL', 'COLLECTION'],
        optimization_type: 'FORMAT_AUTOMATION',
      },
      object_story_spec: {
        template_data: {
          multi_share_end_card: false,
          show_multiple_images: false,
        },
      },
    });
    expect(result.preview.creative.object_story_spec).not.toHaveProperty('link_data');
    expect(result.preview.creative.object_story_spec).not.toHaveProperty('child_attachments');
    expect(result.preview.creative).not.toHaveProperty('omnichannel_link_spec');
  });

  it('builds a CPAS catalog video with its published Instant Experience and retailer template', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      creativeFormat: 'catalog_video',
      video: {
        videoId: 'video_1',
        instantExperienceId: 'canvas_1',
        retailerAppId: 'app_1',
      },
    });

    expect(result.preview.creative).toMatchObject({
      template_url_spec: { config: { app_id: 'app_1' } },
      object_story_spec: {
        video_data: {
          video_id: 'video_1',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://fb.com/canvas_doc/canvas_1' },
          },
          retailer_item_ids: ['0', '0', '0', '0'],
          post_click_configuration: {
            post_click_item_headline: '{{product.name}}',
          },
        },
      },
    });
    expect(result.preview.creative).not.toHaveProperty('product_set_id');
    expect(result.preview.creative).not.toHaveProperty('omnichannel_link_spec');
  });

  it('builds the CPAS video-carousel hybrid with one static video card and one dynamic product card', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      creativeFormat: 'catalog_video_carousel',
      hybridVideo: { videoId: 'video_1', thumbnailUrl: 'https://cdn.example/video.jpg' },
    });

    expect(result.preview.creative).toMatchObject({
      product_set_id: 'ps_1',
      object_story_spec: {
        template_data: {
          child_attachments: [
            {
              video_id: 'video_1',
              picture: 'https://cdn.example/video.jpg',
              static_card: true,
            },
            { name: '{{product.name}}' },
          ],
          multi_share_end_card: false,
          show_multiple_images: false,
        },
      },
      asset_feed_spec: { ad_formats: ['CAROUSEL', 'COLLECTION'] },
    });
    expect(result.preview.creative).not.toHaveProperty('template_url_spec');
  });

  it('requires confirmation before creating any paused object', async () => {
    const client = createMockClient();

    const result = await createCpasCatalogCampaignBundle(client, payload, { dryRun: false });

    expect(result).toMatchObject({ status: 'pending_confirmation', executed: false });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('creates campaign, ad set, catalog creative, and ad in order when confirmed', async () => {
    const client = createMockClient();
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post
      .mockResolvedValueOnce({ id: 'campaign_1' })
      .mockResolvedValueOnce({ id: 'adset_1' })
      .mockResolvedValueOnce({ id: 'creative_1' })
      .mockResolvedValueOnce({ id: 'ad_1' });
    const getObject = client.metaGetObject as ReturnType<typeof vi.fn>;
    getObject
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({
        id: 'campaign_1',
        objective: 'OUTCOME_SALES',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      });

    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        campaignSettings: { specialAdCategories: ['EMPLOYMENT'] },
        adSetSettings: {
          bidStrategy: 'COST_CAP',
          bidAmount: 1250,
          customAudiences: [{ id: 'audience-1' }],
          advantageAudience: 1,
          dsaBeneficiary: 'Brand PT',
        },
        creativeSettings: {
          showMultipleImages: true,
          preferredImageTags: ['front'],
          categorizationCriteria: 'product_type',
          urlTags: 'utm_source=meta',
        },
      },
      {
        dryRun: false,
        confirmed: true,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({
      status: 'executed',
      executed: true,
      productSet: { id: 'ps_1', catalogId: 'catalog_1', productCount: 12 },
      ids: {
        campaignId: 'campaign_1',
        adSetId: 'adset_1',
        creativeId: 'creative_1',
        adId: 'ad_1',
      },
    });
    expect(post).toHaveBeenCalledTimes(4);
    expect(post.mock.calls.map(([path]) => path)).toEqual([
      expect.stringContaining('/campaigns'),
      expect.stringContaining('/adsets'),
      expect.stringContaining('/adcreatives'),
      expect.stringContaining('/ads'),
    ]);
    expect(post.mock.calls[0][1]).toMatchObject({
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      special_ad_categories: ['EMPLOYMENT'],
      promoted_object: {
        product_catalog_id: 'catalog_1',
        smart_pse_enabled: false,
      },
    });
    expect(post.mock.calls[1][1]).toMatchObject({
      status: 'PAUSED',
      destination_type: 'UNDEFINED',
      bid_amount: 1250,
      bid_strategy: 'COST_CAP',
      dsa_beneficiary: 'Brand PT',
      targeting: {
        custom_audiences: [{ id: 'audience-1' }],
        targeting_automation: { advantage_audience: 1 },
      },
      promoted_object: {
        product_set_id: 'ps_1',
        custom_event_type: 'PURCHASE',
        variation: 'PRODUCT_SET_AND_OMNICHANNEL',
        smart_pse_enabled: false,
      },
    });
    expect(post.mock.calls[2][1]).toMatchObject({
      product_set_id: 'ps_1',
      categorization_criteria: 'product_type',
      url_tags: 'utm_source=meta',
      object_story_spec: {
        template_data: {
          show_multiple_images: true,
          preferred_image_tags: ['front'],
        },
      },
    });
    expect(post.mock.calls[1][1].promoted_object).not.toHaveProperty('product_catalog_id');
    expect(post.mock.calls[2][1]).not.toHaveProperty('omnichannel_link_spec');
    expect(post.mock.calls[2][1]).not.toHaveProperty('applink_treatment');
  });

  it('resumes from existing campaign and ad set without creating duplicates', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post.mockResolvedValueOnce({ id: 'creative_1' }).mockResolvedValueOnce({ id: 'ad_1' });

    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: { campaignId: 'campaign_existing', adSetId: 'adset_existing' },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'executed',
      executed: true,
      ids: {
        campaignId: 'campaign_existing',
        adSetId: 'adset_existing',
        creativeId: 'creative_1',
        adId: 'ad_1',
      },
    });
    expect(post.mock.calls.map(([path]) => path)).toEqual([
      expect.stringContaining('/adcreatives'),
      expect.stringContaining('/ads'),
    ]);
  });

  it('returns reusable resume IDs when a later stage fails', async () => {
    const client = createMockClient();
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post
      .mockResolvedValueOnce({ id: 'campaign_1' })
      .mockResolvedValueOnce({ id: 'adset_1' })
      .mockRejectedValueOnce(new Error('creative failed'));
    const getObject = client.metaGetObject as ReturnType<typeof vi.fn>;
    getObject
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'campaign_1', objective: 'OUTCOME_SALES' });

    const result = await createCpasCatalogCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'creative',
      resumeFrom: { campaignId: 'campaign_1', adSetId: 'adset_1' },
    });
  });

  it('reports campaign failure without a resume chain', async () => {
    const client = createMockClient();
    (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('campaign failed')
    );

    const result = await createCpasCatalogCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({ status: 'failed', stage: 'campaign' });
    expect(result).not.toHaveProperty('resumeFrom');
  });

  it('returns the campaign ID when ad-set creation fails', async () => {
    const client = createMockClient();
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post
      .mockResolvedValueOnce({ id: 'campaign_1' })
      .mockRejectedValueOnce(new Error('ad set failed'));
    const getObject = client.metaGetObject as ReturnType<typeof vi.fn>;
    getObject
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'ps_1', product_catalog: 'catalog_1', product_count: 12 })
      .mockResolvedValueOnce({ id: 'campaign_1', objective: 'OUTCOME_SALES' });

    const result = await createCpasCatalogCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'adSet',
      resumeFrom: { campaignId: 'campaign_1' },
    });
  });

  it('resumes from an existing creative and creates only the missing ad', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post.mockResolvedValueOnce({ id: 'ad_1' });

    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'executed',
      ids: {
        campaignId: 'campaign_existing',
        adSetId: 'adset_existing',
        creativeId: 'creative_existing',
        adId: 'ad_1',
      },
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toContain('/ads');
  });

  it('accepts a fully verified paused resume chain without creating duplicates', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({ status: 'executed', executed: true });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('rejects a single-image resume creative rendered as a carousel', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        creativeFormat: 'catalog_single_image',
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({ status: 'failed', code: 'UNSAFE_CPAS_CATALOG_RESUME' });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('rejects a video-carousel creative when resuming a plain catalog carousel', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const read = client.metaGetObject as ReturnType<typeof vi.fn>;
    const original = read.getMockImplementation() as (
      path: string,
      ...args: unknown[]
    ) => Promise<Record<string, unknown>>;
    read.mockImplementation(async (path: string, ...args: unknown[]) => {
      const result = await original(path, ...args);
      return path === '/creative_existing'
        ? {
            ...result,
            asset_feed_spec: { ad_formats: ['CAROUSEL', 'COLLECTION'] },
            object_story_spec: {
              page_id: 'page_1',
              template_data: {
                message: 'Temukan produk pilihan untukmu.',
                name: 'Belanja sekarang',
                link: 'https://shopee.co.id',
                call_to_action: { type: 'SHOP_NOW' },
                child_attachments: [{ video_id: 'video_1' }],
              },
            },
          }
        : result;
    });
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        creativeFormat: 'catalog_carousel',
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({ status: 'failed', code: 'UNSAFE_CPAS_CATALOG_RESUME' });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('accepts catalog video resume when product set is bound at the ad set', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const read = client.metaGetObject as ReturnType<typeof vi.fn>;
    const original = read.getMockImplementation() as (
      path: string,
      ...args: unknown[]
    ) => Promise<Record<string, unknown>>;
    read.mockImplementation(async (path: string, ...args: unknown[]) =>
      path === '/creative_existing'
        ? {
            id: 'creative_existing',
            account_id: '123',
            template_url_spec: { config: { app_id: 'app_1' } },
            object_story_spec: {
              page_id: 'page_1',
              video_data: {
                video_id: 'video_1',
                message: 'Temukan produk pilihan untukmu.',
                title: 'Belanja sekarang',
                call_to_action: {
                  type: 'SHOP_NOW',
                  value: { link: 'https://fb.com/canvas_doc/instant_1' },
                },
              },
            },
          }
        : original(path, ...args)
    );
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        creativeFormat: 'catalog_video',
        video: { videoId: 'video_1', instantExperienceId: 'instant_1', retailerAppId: 'app_1' },
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({ status: 'executed', executed: true });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it.each([
    ['other_video', 'Temukan produk pilihan untukmu.'],
    ['video_1', 'Other copy'],
  ])('rejects catalog video resume using video %s and copy %s', async (videoId, creativeCopy) => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const read = client.metaGetObject as ReturnType<typeof vi.fn>;
    const original = read.getMockImplementation() as (
      path: string,
      ...args: unknown[]
    ) => Promise<Record<string, unknown>>;
    read.mockImplementation(async (path: string, ...args: unknown[]) =>
      path === '/creative_existing'
        ? {
            id: 'creative_existing',
            account_id: '123',
            template_url_spec: { config: { app_id: 'app_1' } },
            object_story_spec: {
              page_id: 'page_1',
              video_data: {
                video_id: videoId,
                message: creativeCopy,
                title: 'Belanja sekarang',
                call_to_action: {
                  type: 'SHOP_NOW',
                  value: { link: 'https://fb.com/canvas_doc/instant_1' },
                },
              },
            },
          }
        : original(path, ...args)
    );
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        creativeFormat: 'catalog_video',
        video: { videoId: 'video_1', instantExperienceId: 'instant_1', retailerAppId: 'app_1' },
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({ status: 'failed', code: 'UNSAFE_CPAS_CATALOG_RESUME' });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it.each([
    ['cover_image_1', 'instant_1', 'Temukan produk pilihan untukmu.', true],
    ['other_cover', 'instant_1', 'Temukan produk pilihan untukmu.', false],
    ['cover_image_1', 'other_instant', 'Temukan produk pilihan untukmu.', false],
    ['cover_image_1', 'instant_1', 'Other copy', false],
  ])(
    'verifies collection cover %s and destination %s on resume',
    async (coverHash, instantId, creativeCopy, accepted) => {
      const client = createMockClient();
      mockSafeResumeReads(client);
      const read = client.metaGetObject as ReturnType<typeof vi.fn>;
      const original = read.getMockImplementation() as (
        path: string,
        ...args: unknown[]
      ) => Promise<Record<string, unknown>>;
      read.mockImplementation(async (path: string, ...args: unknown[]) =>
        path === '/creative_existing'
          ? {
              id: 'creative_existing',
              account_id: '123',
              object_story_spec: {
                page_id: 'page_1',
                link_data: {
                  image_hash: coverHash,
                  link: `https://fb.com/canvas_doc/${instantId}`,
                  message: creativeCopy,
                  name: 'Belanja sekarang',
                  call_to_action: { type: 'SHOP_NOW' },
                },
              },
            }
          : original(path, ...args)
      );
      const result = await createCpasCatalogCampaignBundle(
        client,
        {
          ...payload,
          creativeFormat: 'collection',
          collection: { instantExperienceId: 'instant_1', coverImageHash: 'cover_image_1' },
          resumeFrom: {
            campaignId: 'campaign_existing',
            adSetId: 'adset_existing',
            creativeId: 'creative_existing',
            adId: 'ad_existing',
          },
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe(accepted ? 'executed' : 'failed');
      expect(client.metaPost).not.toHaveBeenCalled();
    }
  );

  it('returns all reusable parent IDs when ad creation fails', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const post = client.metaPost as ReturnType<typeof vi.fn>;
    post.mockRejectedValueOnce(new Error('ad failed'));

    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'ad',
      resumeFrom: {
        campaignId: 'campaign_existing',
        adSetId: 'adset_existing',
        creativeId: 'creative_existing',
      },
    });
  });

  it('rejects an incomplete resume chain before creating anything', async () => {
    const client = createMockClient();

    const result = await createCpasCatalogCampaignBundle(client, {
      ...payload,
      resumeFrom: { campaignId: '', adSetId: 'adset_without_campaign' },
    });

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'INVALID_CPAS_CATALOG_RESUME_CHAIN',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('rejects an empty campaign resume ID instead of silently creating a duplicate', async () => {
    const client = createMockClient();
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: { campaignId: ' ' },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'INVALID_CPAS_CATALOG_RESUME_CHAIN',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('rejects resume with advanced settings that are not verified on readback', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        adSetSettings: { bidStrategy: 'COST_CAP', bidAmount: 1250 },
        resumeFrom: { campaignId: 'campaign_existing', adSetId: 'adset_existing' },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'UNVERIFIABLE_CPAS_CATALOG_RESUME_SETTINGS',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('accepts Meta readback defaults for campaign-level bidding and location types', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const read = client.metaGetObject as ReturnType<typeof vi.fn>;
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (...args: unknown[]) => {
      const result = await original(...args);
      if (args[0] !== '/adset_existing') return result;
      return {
        ...result,
        bid_strategy: null,
        targeting: {
          ...result.targeting,
          geo_locations: {
            countries: ['ID'],
            location_types: ['frequently_in', 'home', 'recent'],
          },
        },
      };
    });
    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );
    expect(result.status).toBe('executed');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('rejects an extra subscriber universe even with otherwise safe Meta readback defaults', async () => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const read = client.metaGetObject as ReturnType<typeof vi.fn>;
    const original = read.getMockImplementation()!;
    read.mockImplementation(async (...args: unknown[]) => {
      const result = await original(...args);
      if (args[0] !== '/adset_existing') return result;
      return {
        ...result,
        bid_strategy: null,
        targeting: {
          ...result.targeting,
          geo_locations: { countries: ['ID'], location_types: ['frequently_in', 'home', 'recent'] },
          subscriber_universe: { messaging_customer_base_for_whatsapp: { id: 'aud_1' } },
        },
      };
    });
    const result = await createCpasCatalogCampaignBundle(
      client,
      { ...payload, resumeFrom: { campaignId: 'campaign_existing', adSetId: 'adset_existing' } },
      { dryRun: false, confirmed: true }
    );
    expect(result).toMatchObject({ status: 'failed', code: 'UNSAFE_CPAS_CATALOG_RESUME' });
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong account', '/campaign_existing', { account_id: '999' }],
    ['active campaign', '/campaign_existing', { status: 'ACTIVE' }],
    ['wrong catalog', '/campaign_existing', { promoted_object: { product_catalog_id: 'other' } }],
    ['wrong campaign budget', '/campaign_existing', { daily_budget: '300000' }],
    ['wrong campaign name', '/campaign_existing', { name: 'Other campaign' }],
    ['wrong campaign bid strategy', '/campaign_existing', { bid_strategy: 'COST_CAP' }],
    ['wrong parent', '/adset_existing', { campaign_id: 'other' }],
    ['active ad set', '/adset_existing', { status: 'ACTIVE' }],
    ['wrong product set', '/adset_existing', { promoted_object: { product_set_id: 'other' } }],
    ['wrong ad set name', '/adset_existing', { name: 'Other ad set' }],
    ['wrong destination', '/adset_existing', { destination_type: 'WEBSITE' }],
    ['wrong optimization', '/adset_existing', { optimization_goal: 'LINK_CLICKS' }],
    ['wrong ad set bid strategy', '/adset_existing', { bid_strategy: 'COST_CAP' }],
    ['unexpected ad set bid amount', '/adset_existing', { bid_strategy: null, bid_amount: 1500 }],
    [
      'different location types',
      '/adset_existing',
      {
        targeting: {
          geo_locations: { countries: ['ID'], location_types: ['home'] },
          age_min: 18,
        },
      },
    ],
    ['wrong country', '/adset_existing', { targeting: { geo_locations: { countries: ['US'] } } }],
    [
      'wrong age',
      '/adset_existing',
      { targeting: { geo_locations: { countries: ['ID'] }, age_min: 25 } },
    ],
    [
      'extra audience',
      '/adset_existing',
      {
        targeting: {
          geo_locations: { countries: ['ID'] },
          age_min: 18,
          custom_audiences: [{ id: 'aud_1' }],
        },
      },
    ],
    [
      'extra placement restriction',
      '/adset_existing',
      {
        targeting: {
          geo_locations: { countries: ['ID'] },
          age_min: 18,
          publisher_platforms: ['instagram'],
        },
      },
    ],
    [
      'different age maximum',
      '/adset_existing',
      { targeting: { geo_locations: { countries: ['ID'] }, age_min: 18, age_max: 35 } },
    ],
    [
      'different audience automation',
      '/adset_existing',
      {
        targeting: {
          geo_locations: { countries: ['ID'] },
          age_min: 18,
          targeting_automation: { advantage_audience: 1 },
        },
      },
    ],
    ['wrong creative account', '/creative_existing', { account_id: '999' }],
    ['wrong creative product set', '/creative_existing', { product_set_id: 'other' }],
    [
      'wrong generic catalog presentation',
      '/creative_existing',
      { asset_feed_spec: { ad_formats: ['CAROUSEL'] } },
    ],
    ['wrong creative page', '/creative_existing', { object_story_spec: { page_id: 'other' } }],
    [
      'wrong creative destination',
      '/creative_existing',
      {
        object_story_spec: {
          page_id: 'page_1',
          template_data: {
            message: 'Temukan produk pilihan untukmu.',
            name: 'Belanja sekarang',
            link: 'https://other.example',
          },
        },
      },
    ],
    [
      'wrong creative CTA',
      '/creative_existing',
      {
        object_story_spec: {
          page_id: 'page_1',
          template_data: {
            message: 'Temukan produk pilihan untukmu.',
            name: 'Belanja sekarang',
            link: 'https://shopee.co.id',
            call_to_action: { type: 'LEARN_MORE' },
          },
        },
      },
    ],
    [
      'wrong creative copy',
      '/creative_existing',
      {
        object_story_spec: {
          page_id: 'page_1',
          template_data: {
            message: 'Other copy',
            name: 'Belanja sekarang',
            link: 'https://shopee.co.id',
            call_to_action: { type: 'SHOP_NOW' },
          },
        },
      },
    ],
    ['wrong ad parent', '/ad_existing', { adset_id: 'other' }],
    ['wrong ad creative', '/ad_existing', { creative: { id: 'other' } }],
    ['active ad', '/ad_existing', { status: 'ACTIVE' }],
    ['wrong ad name', '/ad_existing', { name: 'Another ad' }],
  ])('rejects resumeFrom with %s before any POST', async (_label, target, change) => {
    const client = createMockClient();
    mockSafeResumeReads(client);
    const read = client.metaGetObject as ReturnType<typeof vi.fn>;
    const original = read.getMockImplementation() as (
      path: string,
      ...args: unknown[]
    ) => Promise<Record<string, unknown>>;
    read.mockImplementation(async (path: string, ...args: unknown[]) => {
      const result = await original(path, ...args);
      return path === target ? { ...result, ...change } : result;
    });

    const result = await createCpasCatalogCampaignBundle(
      client,
      {
        ...payload,
        resumeFrom: {
          campaignId: 'campaign_existing',
          adSetId: 'adset_existing',
          creativeId: 'creative_existing',
          adId: 'ad_existing',
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'failed',
      stage: 'preflight',
      code: 'UNSAFE_CPAS_CATALOG_RESUME',
    });
    expect(client.metaPost).not.toHaveBeenCalled();
  });
});
