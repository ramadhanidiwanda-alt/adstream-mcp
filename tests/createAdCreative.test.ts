import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAdCreative } from '../src/tools/createAdCreative.js';
import { MetaApiError } from '../src/utils/metaError.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createAdCreative', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockMetaGet: MetaPostMock = vi.fn();
  const mockMetaGetObject: MetaPostMock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
    metaGet: mockMetaGet,
    metaGetObject: mockMetaGetObject,
  } as unknown as MetaClient;

  const baseOpts = {
    adAccountId: 'act_123',
    name: 'Test Creative',
    pageId: '1001',
    linkData: {
      link: 'https://example.com',
      message: 'Buy now',
      callToAction: { type: 'SHOP_NOW' as const, value: { link: 'https://example.com' } },
    },
  };

  const collaborativeCatalogOptions = {
    adAccountId: 'act_123',
    name: 'Collaborative Catalog',
    pageId: '1001',
    mode: 'collaborative_ads' as const,
    collaborativeProductSetId: 'product-set-1',
    creative: {
      creativeFormat: 'catalog' as const,
      creativeSpec: {
        productSetId: 'product-set-1',
        primaryText: 'Shop the catalog',
        destinationUrl: 'https://example.com',
      },
    },
  };

  const standardImageOptions = {
    adAccountId: 'act_123',
    name: 'Standard Image',
    pageId: '1001',
    creative: {
      creativeFormat: 'single_image' as const,
      creativeSpec: {
        imageHash: 'image-hash-1',
        primaryText: 'Buy now',
        destinationUrl: 'https://example.com',
      },
    },
  };

  const placementImageOptions = {
    adAccountId: 'act_123',
    name: 'Placement Image',
    pageId: '1001',
    creative: {
      creativeFormat: 'placement_image' as const,
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Payday Glowday',
        headline: 'PAYDAY GLOWDAY',
        destinationUrl: 'https://api.whatsapp.com/send',
        callToAction: 'WHATSAPP_MESSAGE',
      },
    },
  };

  const placementReadBack = {
    id: 'creative-placement',
    asset_feed_spec: {
      images: [
        { hash: 'feed-hash', adlabels: [{ name: 'placement_feed_1_1' }] },
        { hash: 'vertical-hash', adlabels: [{ name: 'placement_vertical_9_16' }] },
      ],
      asset_customization_rules: [
        {
          image_label: { name: 'placement_feed_1_1' },
          customization_spec: {
            facebook_positions: ['feed'],
            instagram_positions: ['stream'],
          },
        },
        {
          image_label: { name: 'placement_vertical_9_16' },
          customization_spec: {
            facebook_positions: ['facebook_reels', 'story'],
            instagram_positions: ['reels', 'story'],
          },
        },
      ],
    },
  };

  const ctwaPlacementOptions = {
    adAccountId: 'act_123',
    name: 'CTWA Placement',
    pageId: '1001',
    creative: {
      creativeFormat: 'placement_customized_ctwa' as const,
      creativeSpec: {
        feedImageHash: 'feed-hash',
        verticalImageHash: 'vertical-hash',
        primaryText: 'Chat admin sekarang',
        headline: 'Promo WhatsApp',
        destinationUrl: 'https://api.whatsapp.com/send',
        pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetaGet.mockResolvedValue({ data: [] });
  });

  it('returns dry_run without calling API', async () => {
    const r = await createAdCreative(mockClient, baseOpts);
    expect(r.status).toBe('dry_run');
    expect(r.executed).toBe(false);
    expect(r.preview.name).toBe('Test Creative');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('keeps the legacy linkData dry-run preview backward-compatible', async () => {
    const result = await createAdCreative(mockClient, baseOpts);

    expect(result.preview).toEqual({
      name: 'Test Creative',
      object_story_spec: {
        page_id: '1001',
        link_data: {
          link: 'https://example.com',
          message: 'Buy now',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://example.com' },
          },
        },
      },
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('uses creativeFormat and creativeSpec instead of legacy linkData', async () => {
    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_1',
        name: 'Poster Payday',
        pageId: 'page-1',
        mode: 'standard',
        creative: {
          creativeFormat: 'single_image',
          creativeSpec: {
            imageHash: 'image-1',
            primaryText: 'Promo Payday',
            destinationUrl: 'https://example.com',
            callToAction: 'SHOP_NOW',
          },
        },
        linkData: {
          link: 'https://legacy.example.com',
          message: 'Legacy copy',
          callToAction: {
            type: 'LEARN_MORE',
            value: { link: 'https://legacy.example.com' },
          },
        },
      },
      { dryRun: true }
    );

    expect(result.preview).toMatchObject({
      name: 'Poster Payday',
      object_story_spec: {
        page_id: 'page-1',
        link_data: { image_hash: 'image-1' },
      },
    });
    expect(result.preview).not.toHaveProperty('object_story_spec.link_data.message', 'Legacy copy');
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('builds an Instant Form Leads dry-run with the form CTA', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Consultation Leads',
      pageId: 'page-1',
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'INSTANT_FORM',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Book a consultation',
          headline: 'Talk to our team',
          callToAction: 'SIGN_UP',
          leadFormId: 'form-1',
        },
      },
    });

    expect(result.preview).toMatchObject({
      object_story_spec: {
        page_id: 'page-1',
        link_data: {
          call_to_action: { type: 'SIGN_UP', value: { lead_gen_form_id: 'form-1' } },
        },
      },
    });
  });

  it('rejects an objective-aware Instant Form Lead without a form ID', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Incomplete Leads',
      pageId: 'page-1',
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'INSTANT_FORM',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Book a consultation',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/leadFormId wajib diisi/i),
    });
  });

  it.each([
    {
      label: 'Awareness image',
      objective: 'OUTCOME_AWARENESS',
      conversionLocation: 'AWARENESS',
      creative: {
        creativeFormat: 'single_image' as const,
        creativeSpec: {
          destinationMode: 'EXTERNAL_URL' as const,
          imageHash: 'image-1',
          primaryText: 'Kenali brand kami',
          destinationUrl: 'https://example.com/should-not-be-used',
        },
      },
      expectedStory: {
        photo_data: { image_hash: 'image-1', message: 'Kenali brand kami' },
      },
    },
    {
      label: 'Engagement video',
      objective: 'OUTCOME_ENGAGEMENT',
      conversionLocation: 'VIDEO',
      creative: {
        creativeFormat: 'video' as const,
        creativeSpec: {
          destinationMode: 'EXTERNAL_URL' as const,
          videoId: 'video-1',
          primaryText: 'Tonton videonya',
          destinationUrl: 'https://example.com/should-not-be-used',
        },
      },
      expectedStory: {
        video_data: { video_id: 'video-1', message: 'Tonton videonya' },
      },
    },
  ])(
    'uses the resolved no-destination mode for $label despite a conflicting creative spec',
    async ({ objective, conversionLocation, creative, expectedStory }) => {
      const result = await createAdCreative(mockClient, {
        adAccountId: 'act_1',
        name: `${objective} creative`,
        pageId: 'page-1',
        objective,
        conversionLocation,
        creative,
      });

      expect(result).toMatchObject({
        status: 'dry_run',
        preview: { object_story_spec: expectedStory },
      });
      expect(result.preview).not.toHaveProperty('object_story_spec.link_data');
      expect(result.preview).not.toHaveProperty('object_story_spec.video_data.call_to_action');
    }
  );

  it('requires a Traffic destination URL despite a conflicting no-destination creative spec', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Traffic requires a URL',
      pageId: 'page-1',
      objective: 'OUTCOME_TRAFFIC',
      conversionLocation: 'WEBSITE',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          destinationMode: 'NONE',
          imageHash: 'image-1',
          primaryText: 'Kunjungi situs kami',
        },
      },
    });

    expect(result).toMatchObject({ status: 'failed' });
    expect(result.error).toMatch(/destinationUrl wajib diisi/i);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('allows existing_post to omit pageId', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Existing winner',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: { objectStoryId: 'page-1_123' },
      },
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      preview: { name: 'Existing winner', object_story_id: 'page-1_123' },
    });
  });

  it('builds a Click-to-WhatsApp preview from destinationType, welcome message, and welcome flow', async () => {
    const result = await createAdCreative(mockClient, {
      ...baseOpts,
      destinationType: 'WHATSAPP',
      pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      whatsappWelcomeMessageSequenceId: 'flow-1',
    });

    expect(result.status).toBe('dry_run');
    const storySpec = result.preview.object_story_spec as Record<string, unknown>;
    const linkData = storySpec.link_data as Record<string, unknown>;

    // WHATSAPP_MESSAGE must carry no value: wa.me needs a display phone number,
    // which the creative never has, so Meta resolves the destination itself.
    expect(linkData.call_to_action).toEqual({ type: 'WHATSAPP_MESSAGE' });
    expect(linkData.page_welcome_message).toBe('{"type":"VISUAL_EDITOR"}');
    expect(result.preview.asset_feed_spec).toEqual({
      additional_data: { partner_app_welcome_message_flow_id: 'flow-1' },
    });
  });

  // Mirrors the payload verified live against Meta v25.0 on 2026-07-24: everything
  // sits at the top level. Nesting the destination in object_story_spec makes Meta
  // reject the create with (#100) subcode 1487929 "Ambiguous Promoted Object".
  it('previews source_instagram_media_id, call_to_action, and url_tags at the top level', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_426223085194693',
      name: 'EP IG Reel 01',
      pageId: '330290916841848',
      urlTags: 'gcn={{campaign.name}}&utm_source=ig',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          destinationUrl: 'https://hurricane.gass.my.id/cta?p=1',
          callToAction: 'LEARN_MORE',
        },
      },
    });

    expect(mockMetaPost).not.toHaveBeenCalled();
    expect(result.status).toBe('dry_run');
    expect(result.preview).toEqual({
      name: 'EP IG Reel 01',
      source_instagram_media_id: '18571075747064659',
      call_to_action: {
        type: 'LEARN_MORE',
        value: { link: 'https://hurricane.gass.my.id/cta?p=1' },
      },
      url_tags: 'gcn={{campaign.name}}&utm_source=ig',
    });
  });

  it('returns a structured validation error when a canonical creative requires pageId', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Missing identity',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Promo Payday',
          destinationUrl: 'https://example.com',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('pageId'),
      },
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'dry-run', execOptions: { dryRun: true } },
    { label: 'confirmed execution', execOptions: { dryRun: false, confirmed: true } },
  ])(
    'rejects an empty direct creative call during $label without POST',
    async ({ execOptions }) => {
      const result = await createAdCreative(
        mockClient,
        {
          adAccountId: 'act_1',
          name: 'Name only is not a creative',
        },
        execOptions
      );

      expect(result).toMatchObject({
        status: 'failed',
        executed: false,
        preview: { name: 'Name only is not a creative' },
        structuredError: {
          provider: 'meta',
          code: 'VALIDATION_ERROR',
          message: expect.stringMatching(/konten creative.*wajib/i),
        },
      });
      expect(result.error).toMatch(/creative.*objectStorySpec.*linkData/i);
      expect(mockMetaPost).not.toHaveBeenCalled();
    }
  );

  it('enforces pageId for legacy creative paths', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Legacy without identity',
      linkData: baseOpts.linkData,
    });

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('pageId'),
      },
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects a mismatched Collaborative Ads product set before POST', async () => {
    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_1',
        name: 'Catalog mismatch',
        pageId: 'page-1',
        mode: 'collaborative_ads',
        collaborativeProductSetId: 'set-from-adset',
        creative: {
          creativeFormat: 'catalog',
          creativeSpec: {
            productSetId: 'set-from-creative',
            primaryText: 'Shop now',
            destinationUrl: 'https://example.com/catalog',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: {
        provider: 'meta',
        code: 'VALIDATION_ERROR',
        message: 'Product set creative dan ad set harus sama.',
      },
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('includes Instagram and Threads identities in object_story_spec preview', async () => {
    const r = await createAdCreative(mockClient, {
      ...baseOpts,
      instagramUserId: 'ig_123',
      threadsProfileId: 'threads_456',
    });

    expect(r.preview.object_story_spec).toMatchObject({
      page_id: '1001',
      instagram_user_id: 'ig_123',
      threads_profile_id: 'threads_456',
    });
  });

  it('moves a Dynamic Creative asset_feed_spec out of object_story_spec without losing variants', async () => {
    const assetFeedSpec = {
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
    };

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Dynamic Creative',
      pageId: '1001',
      objectStorySpec: {
        asset_feed_spec: assetFeedSpec,
      },
    });

    expect(result.preview).toMatchObject({
      name: 'Dynamic Creative',
      object_story_spec: { page_id: '1001' },
      asset_feed_spec: assetFeedSpec,
    });
    expect(result.preview.object_story_spec).not.toHaveProperty('asset_feed_spec');
  });

  it('sends every Dynamic Creative variant to Meta on execution', async () => {
    const assetFeedSpec = {
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
    };
    mockMetaPost.mockResolvedValueOnce({ id: 'creative_dynamic_123' });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_123',
        name: 'Dynamic Creative',
        pageId: '1001',
        objectStorySpec: { page_id: '1001', asset_feed_spec: assetFeedSpec },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({ status: 'executed', id: 'creative_dynamic_123' });
    expect(mockMetaPost).toHaveBeenCalledWith(
      '/act_123/adcreatives',
      expect.objectContaining({
        object_story_spec: { page_id: '1001' },
        asset_feed_spec: assetFeedSpec,
      }),
      3
    );
  });

  it('accepts the official top-level assetFeedSpec input for Dynamic Creative', async () => {
    const assetFeedSpec = {
      ad_formats: ['AUTOMATIC_FORMAT'],
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      images: [{ hash: 'image_hash_1' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
      call_to_action_types: ['LEARN_MORE'],
    };

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Official Dynamic Creative',
      pageId: '1001',
      objectStorySpec: { page_id: '1001' },
      assetFeedSpec,
    });

    expect(result.preview).toMatchObject({
      object_story_spec: { page_id: '1001' },
      asset_feed_spec: assetFeedSpec,
    });
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: false,
    });
    expect(r.status).toBe('pending_confirmation');
    expect(r.error).toContain('confirmation');
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('executes and returns id on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'c123' });
    const r = await createAdCreative(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed');
    expect(r.id).toBe('c123');
    expect(mockMetaPost).toHaveBeenCalledTimes(1);
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('reads an executed creative back and reports verification separately', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-1' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-1',
      product_set_id: 'product-set-1',
      object_story_spec: { template_data: {} },
      omnichannel_link_spec: { web: { url: 'https://example.com' } },
    });

    const result = await createAdCreative(mockClient, collaborativeCatalogOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('executed');
    expect(result.verification).toMatchObject({
      status: 'verified',
      creativeId: 'creative-1',
      effectiveFormat: 'catalog',
    });
    expect(mockMetaGetObject).toHaveBeenCalledWith(
      '/creative-1',
      {
        fields:
          'id,name,object_story_id,object_story_spec,asset_feed_spec,platform_customizations,portrait_customizations,degrees_of_freedom_spec,media_sourcing_spec,product_set_id,omnichannel_link_spec,effective_object_story_id,source_instagram_media_id',
      },
      3
    );
  });

  it('verifies both placement image labels and rules after creation', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-placement' });
    mockMetaGetObject.mockResolvedValueOnce(placementReadBack);

    const result = await createAdCreative(mockClient, placementImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({ status: 'executed', executed: true });
    expect(result.verification).toMatchObject({
      status: 'verified',
      effectiveFormat: 'placement_image',
      summary: {
        placementImageCount: 2,
        placementRuleCount: 2,
        hasFeedPlacementRule: true,
        hasVerticalPlacementRule: true,
      },
    });
  });

  it('verifies CTWA placement customization without asset_feed_spec after creation', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-ctwa-placement' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-ctwa-placement',
      object_story_spec: {
        link_data: {
          image_hash: 'feed-hash',
          page_welcome_message: '{"type":"VISUAL_EDITOR"}',
        },
      },
      platform_customizations: {
        instagram: { image_hash: 'vertical-hash' },
      },
      portrait_customizations: { image_hash: 'vertical-hash' },
      degrees_of_freedom_spec: {
        creative_features_spec: {
          standard_enhancements: { enroll_status: 'OPT_OUT' },
        },
      },
      media_sourcing_spec: { related_media: [] },
    });

    const result = await createAdCreative(mockClient, ctwaPlacementOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({ status: 'executed', executed: true });
    expect(result.verification).toMatchObject({
      status: 'verified',
      effectiveFormat: 'placement_customized_ctwa',
      summary: {
        hasLinkData: true,
        hasAssetFeedSpec: false,
        hasPlatformCustomizations: true,
        hasPortraitCustomizations: true,
        hasDegreesOfFreedomSpec: true,
        hasMediaSourcingSpec: true,
      },
    });
  });

  it('fails safely when Meta strips placement customization rules', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-placement' });
    mockMetaGetObject.mockResolvedValueOnce({
      ...placementReadBack,
      asset_feed_spec: { images: placementReadBack.asset_feed_spec.images },
    });

    const result = await createAdCreative(mockClient, placementImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({
      status: 'failed',
      executed: true,
      id: 'creative-placement',
      error: expect.stringMatching(/placement/i),
      verification: {
        status: 'warning',
        summary: {
          placementImageCount: 2,
          placementRuleCount: 0,
          hasFeedPlacementRule: false,
          hasVerticalPlacementRule: false,
        },
      },
    });
  });

  it('returns only a bounded verification summary when Meta read-back contains nested signed URLs', async () => {
    const signedUrl =
      'https://cdn.example.test/private/creative.jpg?X-Amz-Signature=direct-boundary-secret&expires=60';
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-safe-summary' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-safe-summary',
      product_set_id: 'product-set-1',
      object_story_spec: {
        template_data: {
          message: 'Shop the catalog',
          image_url: signedUrl,
        },
      },
      asset_feed_spec: {
        images: [{ url: signedUrl }],
      },
      omnichannel_link_spec: {
        web: { url: signedUrl },
      },
    });

    const result = await createAdCreative(mockClient, collaborativeCatalogOptions, {
      dryRun: false,
      confirmed: true,
    });
    const serialized = JSON.stringify(result);

    expect(result.verification).toMatchObject({
      status: 'verified',
      creativeId: 'creative-safe-summary',
      effectiveFormat: 'catalog',
      summary: {
        productSetId: 'product-set-1',
        hasObjectStorySpec: true,
        hasTemplateData: true,
        hasAssetFeedSpec: true,
        hasOmnichannelLinkSpec: true,
      },
    });
    expect(result.verification).not.toHaveProperty('fields');
    expect(serialized).not.toContain(signedUrl);
    expect(serialized).not.toContain('direct-boundary-secret');
    expect(serialized).not.toContain('cdn.example.test/private/creative.jpg');
  });

  it('verifies an intended catalog despite overlapping Meta response fields', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-1' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-1',
      effective_object_story_id: 'page-1_story-1',
      asset_feed_spec: { images: [{ hash: 'fallback-image' }] },
      product_set_id: 'product-set-1',
      object_story_spec: { template_data: { message: 'Shop the catalog' } },
    });

    const result = await createAdCreative(mockClient, collaborativeCatalogOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.verification).toMatchObject({
      status: 'verified',
      creativeId: 'creative-1',
      effectiveFormat: 'catalog',
    });
  });

  it('checks story IDs only when existing_post is the intended format', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-1' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-1',
      effective_object_story_id: 'page-1_story-1',
      object_story_spec: { link_data: { image_hash: 'image-hash-1' } },
    });

    const result = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.verification).toMatchObject({
      status: 'verified',
      creativeId: 'creative-1',
      effectiveFormat: 'single_image',
    });
  });

  it('keeps successful creation when read-back temporarily fails', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-1' });
    mockMetaGetObject.mockRejectedValueOnce(new Error('temporary read failure'));

    const result = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('executed');
    expect(result.id).toBe('creative-1');
    expect(result.verification).toMatchObject({
      status: 'warning',
      creativeId: 'creative-1',
      warning: expect.any(String),
    });
  });

  it.each([
    {
      format: 'existing_post' as const,
      creativeSpec: { objectStoryId: 'page-1_post-1' },
      readBack: { id: 'creative-1', effective_object_story_id: 'page-1_post-1' },
    },
    {
      format: 'flexible' as const,
      creativeSpec: {
        imageHashes: ['image-1'],
        primaryTexts: ['Primary text'],
        destinationUrl: 'https://example.com',
      },
      readBack: { id: 'creative-1', asset_feed_spec: { images: [{ hash: 'image-1' }] } },
    },
    {
      format: 'collection' as const,
      creativeSpec: {
        instantExperienceId: 'canvas-1',
        coverImageHash: 'image-1',
        primaryText: 'Primary text',
      },
      readBack: {
        id: 'creative-1',
        object_story_spec: {
          link_data: { image_hash: 'image-1', link: 'https://fb.com/canvas_doc/canvas-1' },
        },
      },
    },
    {
      format: 'carousel' as const,
      creativeSpec: {
        primaryText: 'Primary text',
        cards: [
          { imageHash: 'image-1', headline: 'One', destinationUrl: 'https://example.com/1' },
          { imageHash: 'image-2', headline: 'Two', destinationUrl: 'https://example.com/2' },
        ],
      },
      readBack: {
        id: 'creative-1',
        object_story_spec: { link_data: { child_attachments: [{ image_hash: 'image-1' }] } },
      },
    },
    {
      format: 'video' as const,
      creativeSpec: {
        videoId: 'video-1',
        primaryText: 'Primary text',
        destinationUrl: 'https://example.com',
      },
      readBack: { id: 'creative-1', object_story_spec: { video_data: { video_id: 'video-1' } } },
    },
    {
      format: 'single_image' as const,
      creativeSpec: {
        imageHash: 'image-1',
        primaryText: 'Primary text',
        destinationUrl: 'https://example.com',
      },
      readBack: { id: 'creative-1', object_story_spec: { link_data: { image_hash: 'image-1' } } },
    },
  ])('verifies a read-back classified as $format', async ({ format, creativeSpec, readBack }) => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-1' });
    // Video creatives without an explicit thumbnail trigger one extra
    // metaGetObject call (auto-fetch of the video's default picture) before
    // the post-creation read-back verification call — queue that first.
    if (format === 'video') {
      mockMetaGetObject.mockResolvedValueOnce({ picture: 'https://example.com/auto-thumb.jpg' });
    }
    mockMetaGetObject.mockResolvedValueOnce(readBack);

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_123',
        name: `${format} creative`,
        pageId: '1001',
        creative: { creativeFormat: format, creativeSpec } as Parameters<
          typeof createAdCreative
        >[1]['creative'],
      },
      { dryRun: false, confirmed: true }
    );

    expect(result.verification).toMatchObject({
      status: 'verified',
      creativeId: 'creative-1',
      effectiveFormat: format,
    });
  });

  it('warns when Meta reads the creative back as a different format family', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-1' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-1',
      object_story_spec: { video_data: { video_id: 'video-1' } },
    });

    const result = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result).toMatchObject({ status: 'executed', id: 'creative-1' });
    expect(result.verification).toMatchObject({
      status: 'warning',
      creativeId: 'creative-1',
      effectiveFormat: 'video',
    });
  });

  it('does not create a duplicate creative when dedupeByName finds an existing one', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'existing_creative_1', name: 'Standard Image', status: 'ACTIVE' }],
    });

    const r = await createAdCreative(
      mockClient,
      {
        ...standardImageOptions,
        dedupeByName: true,
      },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('deduped');
    expect(r.executed).toBe(false);
    expect(r.id).toBe('existing_creative_1');
    expect(mockMetaGet.mock.calls[0][1]).not.toHaveProperty('filtering');
    expect(mockMetaGet.mock.calls[0][2]).toMatchObject({ paginate: true, maxPages: 20 });
    expect(mockMetaPost).not.toHaveBeenCalled();
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('returns failed when no id returned', async () => {
    mockMetaPost.mockResolvedValueOnce({});
    const r = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });
    expect(r.status).toBe('failed');
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('returns failed on API error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('creative error'));
    const r = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });
    expect(r.status).toBe('failed');
    expect(r.error).toBe(
      'Terjadi kegagalan internal saat memproses creative. Coba lagi; jika tetap gagal, periksa log server tanpa mengekspos kredensial. Detail error: creative error'
    );
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('adds guidance before the complete original Meta creative error', async () => {
    mockMetaPost.mockRejectedValueOnce(
      new MetaApiError({
        message: 'Invalid parameter',
        type: 'OAuthException',
        code: 100,
        error_subcode: 2310068,
        error_user_title: 'Product set is unavailable',
        error_user_msg: 'The product set is not shared with this ad account.',
        fbtrace_id: 'trace-creative-1',
      })
    );

    const result = await createAdCreative(mockClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.error).toMatch(/^Pastikan katalog.*Detail Meta: Invalid parameter/i);
    expect(result.error).toContain('Product set is unavailable');
    expect(result.error).toContain('The product set is not shared with this ad account.');
    expect(result.error).toContain('subcode 2310068');
    expect(result.structuredError).toMatchObject({
      providerCode: '100',
      providerSubcode: '2310068',
      providerTitle: 'Product set is unavailable',
      providerMessage: 'The product set is not shared with this ad account.',
      traceId: 'trace-creative-1',
    });
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  describe('video auto-thumbnail', () => {
    const videoOptions = {
      adAccountId: 'act_123',
      name: 'Video Creative',
      pageId: '1001',
      creative: {
        creativeFormat: 'video' as const,
        creativeSpec: {
          videoId: 'video-1',
          primaryText: 'Tonton videonya',
          destinationUrl: 'https://api.whatsapp.com/send',
          callToAction: 'WHATSAPP_MESSAGE',
        },
      },
    };

    it('fetches the video default picture and uses it as image_url when no thumbnail is given', async () => {
      mockMetaGetObject.mockResolvedValueOnce({ picture: 'https://example.com/auto-thumb.jpg' });

      const result = await createAdCreative(mockClient, videoOptions, { dryRun: true });

      expect(mockMetaGetObject).toHaveBeenCalledWith('/video-1', { fields: 'picture' });
      expect(result.preview).toMatchObject({
        object_story_spec: { video_data: { image_url: 'https://example.com/auto-thumb.jpg' } },
      });
    });

    it('does not fetch a thumbnail when thumbnailImageHash is already provided', async () => {
      const optionsWithHash = {
        ...videoOptions,
        creative: {
          ...videoOptions.creative,
          creativeSpec: { ...videoOptions.creative.creativeSpec, thumbnailImageHash: 'hash-1' },
        },
      };

      const result = await createAdCreative(mockClient, optionsWithHash, { dryRun: true });

      expect(mockMetaGetObject).not.toHaveBeenCalled();
      expect(result.preview).toMatchObject({
        object_story_spec: { video_data: { image_hash: 'hash-1' } },
      });
    });

    it('does not fetch a thumbnail when thumbnailImageUrl is already provided', async () => {
      const optionsWithUrl = {
        ...videoOptions,
        creative: {
          ...videoOptions.creative,
          creativeSpec: {
            ...videoOptions.creative.creativeSpec,
            thumbnailImageUrl: 'https://example.com/manual-thumb.jpg',
          },
        },
      };

      const result = await createAdCreative(mockClient, optionsWithUrl, { dryRun: true });

      expect(mockMetaGetObject).not.toHaveBeenCalled();
      expect(result.preview).toMatchObject({
        object_story_spec: { video_data: { image_url: 'https://example.com/manual-thumb.jpg' } },
      });
    });

    it('falls back gracefully (no thumbnail set) when the picture fetch fails', async () => {
      mockMetaGetObject.mockRejectedValueOnce(new Error('network error'));

      const result = await createAdCreative(mockClient, videoOptions, { dryRun: true });

      const videoData = (result.preview.object_story_spec as Record<string, unknown>)
        .video_data as Record<string, unknown>;
      expect(videoData).not.toHaveProperty('image_hash');
      expect(videoData).not.toHaveProperty('image_url');
    });

    it('falls back gracefully when Meta returns no picture field', async () => {
      mockMetaGetObject.mockResolvedValueOnce({});

      const result = await createAdCreative(mockClient, videoOptions, { dryRun: true });

      const videoData = (result.preview.object_story_spec as Record<string, unknown>)
        .video_data as Record<string, unknown>;
      expect(videoData).not.toHaveProperty('image_hash');
      expect(videoData).not.toHaveProperty('image_url');
    });
  });
});
