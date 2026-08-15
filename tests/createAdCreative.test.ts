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

  it('adds top-level omnichannel fields to a legacy poster creative', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'CPAS omnichannel poster',
      pageId: '1001',
      collaborativeAppSpec: {
        applicationId: '957549474255294',
        android: { appName: 'Shopee', packageName: 'com.shopee.id' },
        ios: { appName: 'Shopee', appStoreId: '959841443' },
      },
      objectStorySpec: {
        page_id: '1001',
        link_data: {
          image_hash: 'poster-hash',
          message: 'Promo',
          link: 'https://s.shopee.co.id/promo',
          call_to_action: {
            type: 'SHOP_NOW',
            value: {
              application: '957549474255294',
              object_store_urls: [
                'https://play.google.com/store/apps/details?id=com.shopee.id',
                'https://apps.apple.com/app/id959841443',
              ],
            },
          },
        },
      },
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      preview: {
        applink_treatment: 'automatic',
        omnichannel_link_spec: {
          web: { url: 'https://s.shopee.co.id/promo' },
          app: { application_id: '957549474255294' },
        },
      },
    });
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
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'form-1', name: 'Consultation', status: 'ACTIVE', locale: 'en_US' }],
    });

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
    expect(mockMetaGet).toHaveBeenCalledWith('/page-1/leadgen_forms', {
      fields: 'id,name,status,locale,created_time',
      limit: 50,
    });
  });

  it('builds an App Promotion dry-run with the standard app-install CTA', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Install our app',
      pageId: 'page-1',
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      standardAppSpec: {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
        deepLinkUrl: 'myapp://home',
      },
      creative: {
        creativeFormat: 'video',
        creativeSpec: { videoId: 'video-1', primaryText: 'Install now' },
      },
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      preview: {
        object_story_spec: {
          video_data: {
            call_to_action: {
              type: 'INSTALL_MOBILE_APP',
              value: {
                link: 'myapp://home',
                app_link: 'myapp://home',
                application: 'app-1',
              },
            },
          },
        },
      },
    });
    expect(result.preview).not.toHaveProperty('omnichannel_link_spec');
  });

  it('rejects an App Promotion dry-run without a standard app spec', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Incomplete app install',
      pageId: 'page-1',
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: { imageHash: 'image-1', primaryText: 'Install now' },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/standardAppSpec\.applicationId/i),
    });
  });

  it('rejects a standard app spec outside the canonical App Promotion destination before posting', async () => {
    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_1',
        name: 'Out-of-scope app spec',
        pageId: 'page-1',
        standardAppSpec: {
          applicationId: 'app-1',
          objectStoreUrl: 'https://apps.apple.com/app/id123',
        },
        creative: {
          creativeFormat: 'single_image',
          creativeSpec: {
            imageHash: 'image-1',
            primaryText: 'Visit now',
            destinationUrl: 'https://example.com',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/standardAppSpec.*OUTCOME_APP_PROMOTION.*APP/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects combining standard and collaborative app specs before payload construction', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Ambiguous app spec',
      pageId: 'page-1',
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      standardAppSpec: {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
      },
      collaborativeAppSpec: { applicationId: 'collaborative-app-1' },
      creative: {
        creativeFormat: 'video',
        creativeSpec: { videoId: 'video-1', primaryText: 'Install now' },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/standardAppSpec.*collaborativeAppSpec/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects collaborative_ads mode for canonical App Promotion before payload construction', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Invalid app mode',
      pageId: 'page-1',
      mode: 'collaborative_ads',
      collaborativeProductSetId: 'product-set-1',
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      standardAppSpec: {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
      },
      creative: {
        creativeFormat: 'video',
        creativeSpec: { videoId: 'video-1', primaryText: 'Install now' },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/standardAppSpec.*collaborative_ads/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects WHATSAPP_MESSAGE for canonical App Promotion before payload construction', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Invalid app CTA',
      pageId: 'page-1',
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      standardAppSpec: {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
      },
      creative: {
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          primaryText: 'Install now',
          callToAction: 'WHATSAPP_MESSAGE',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/WHATSAPP_MESSAGE.*App Promotion/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
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

  it('requires a Website Leads destination URL even when a lead form ID is supplied', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Website Leads missing URL',
      pageId: 'page-1',
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'WEBSITE',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Book a consultation',
          leadFormId: 'form-1',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/destinationUrl wajib diisi/i),
    });
  });

  it('rejects a Website Leads form ID instead of overriding the resolved URL destination', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Website Leads with form',
      pageId: 'page-1',
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'WEBSITE',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Book a consultation',
          destinationUrl: 'https://example.com/consultation',
          leadFormId: 'form-1',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/leadFormId.*INSTANT_FORM/i),
    });
  });

  it('rejects an Instant Form that is not owned by the selected Page before posting', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'other-form', name: 'Other Page form', status: 'ACTIVE', locale: 'en_US' }],
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_1',
        name: 'Mismatched Instant Form',
        pageId: 'page-1',
        objective: 'OUTCOME_LEADS',
        conversionLocation: 'INSTANT_FORM',
        creative: {
          creativeFormat: 'single_image',
          creativeSpec: {
            imageHash: 'image-1',
            primaryText: 'Book a consultation',
            leadFormId: 'form-1',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'failed',
      error: expect.stringMatching(/ads_list_lead_forms/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'Awareness image',
      objective: 'OUTCOME_AWARENESS' as const,
      conversionLocation: 'AWARENESS' as const,
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
      objective: 'OUTCOME_ENGAGEMENT' as const,
      conversionLocation: 'VIDEO' as const,
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

  it('keeps CTA, welcome message, and title for an objective-aware Engagement WhatsApp video', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Direct video CTWA',
      pageId: 'page-1',
      instagramUserId: 'ig-1',
      objective: 'OUTCOME_ENGAGEMENT',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      creative: {
        creativeFormat: 'video',
        creativeSpec: {
          videoId: 'video-1',
          thumbnailImageHash: 'thumb-1',
          primaryText: 'Chat dengan kami',
          headline: 'Video CTWA',
          destinationUrl: 'https://api.whatsapp.com/send',
          pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      preview: {
        object_story_spec: {
          page_id: 'page-1',
          instagram_user_id: 'ig-1',
          video_data: {
            video_id: 'video-1',
            image_hash: 'thumb-1',
            message: 'Chat dengan kami',
            title: 'Video CTWA',
            call_to_action: {
              type: 'WHATSAPP_MESSAGE',
              value: {
                link: 'https://api.whatsapp.com/send',
                app_destination: 'WHATSAPP',
              },
            },
            page_welcome_message: { type: 'VISUAL_EDITOR' },
          },
        },
      },
    });
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

  it('builds a Click-to-WhatsApp preview from destinationType and welcome message without asset feed', async () => {
    const result = await createAdCreative(mockClient, {
      ...baseOpts,
      destinationType: 'WHATSAPP',
      pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
    });

    expect(result.status).toBe('dry_run');
    const storySpec = result.preview.object_story_spec as Record<string, unknown>;
    const linkData = storySpec.link_data as Record<string, unknown>;

    // WHATSAPP_MESSAGE must carry no value: wa.me needs a display phone number,
    // which the creative never has, so Meta resolves the destination itself.
    expect(linkData.call_to_action).toEqual({ type: 'WHATSAPP_MESSAGE' });
    expect(linkData.page_welcome_message).toBe('{"type":"VISUAL_EDITOR"}');
    expect(result.preview).not.toHaveProperty('asset_feed_spec');
  });

  it('rejects WhatsApp welcome flow asset-feed writes', async () => {
    const result = await createAdCreative(mockClient, {
      ...baseOpts,
      destinationType: 'WHATSAPP',
      pageWelcomeMessage: '{"type":"VISUAL_EDITOR"}',
      whatsappWelcomeMessageSequenceId: 'flow-1',
    });

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: { code: 'DYNAMIC_CREATIVE_DISABLED' },
    });
    expect(result.error).toMatch(/welcomeMessageSequenceId/i);
  });

  it('defaults a canonical Sales messaging creative to WHATSAPP_MESSAGE', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'Sales CTWA',
      pageId: 'page-1',
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'image-1',
          primaryText: 'Chat admin untuk beli',
          destinationUrl: 'https://wa.me/6281234567890',
        },
      },
    });

    expect(result.status).toBe('dry_run');
    const storySpec = result.preview.object_story_spec as Record<string, unknown>;
    const linkData = storySpec.link_data as Record<string, unknown>;
    expect(linkData.call_to_action).toEqual({ type: 'WHATSAPP_MESSAGE' });
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

  it('previews url_tags at the creative root for a legacy manual video', async () => {
    const urlTags =
      'utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.id}}';
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_2086409658377471',
      name: '29/07 | Jess Luxe | VIDEO',
      pageId: '215116488342403',
      urlTags,
      objectStorySpec: {
        page_id: '215116488342403',
        instagram_user_id: '17841463380041722',
        video_data: {
          video_id: '1366923638102705',
          image_hash: 'dfb20acf31a858f76ca0ad97c20abebb',
          title: 'Skin Booster dari Rumah',
          message: 'Skin Booster sekarang bisa dari rumah?',
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link: 'https://shop.meenaindonesia.com/luxe-new-update' },
          },
        },
      },
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      preview: {
        object_story_spec: {
          video_data: {
            video_id: '1366923638102705',
          },
        },
        url_tags: urlTags,
      },
    });
    expect(result.preview).not.toHaveProperty('asset_feed_spec');
    expect(result.preview).not.toHaveProperty('degrees_of_freedom_spec');
    expect(result.preview).not.toHaveProperty('media_sourcing_spec');
  });

  it.each([
    {
      feature: 'standard_enhancements',
      expectedError: /standard_enhancements.*deprecated.*individual/i,
    },
    {
      feature: 'media_sourcing',
      expectedError: /media_sourcing.*bukan.*creative feature/i,
    },
  ])(
    'rejects unsupported manual-video enhancement key $feature',
    async ({ feature, expectedError }) => {
      const result = await createAdCreative(mockClient, {
        adAccountId: 'act_2086409658377471',
        name: 'Manual video',
        pageId: '215116488342403',
        objectStorySpec: {
          video_data: {
            video_id: 'video-1',
            image_hash: 'image-1',
            message: 'Manual video',
          },
        },
        optOutEnhancements: [feature],
      });

      expect(result).toMatchObject({
        status: 'failed',
        executed: false,
        error: expect.stringMatching(expectedError),
      });
    }
  );

  it('previews an existing Instagram messaging post without re-uploading the media', async () => {
    const pageWelcomeMessage = {
      type: 'VISUAL_EDITOR',
      version: 2,
      text_format: {
        message: {
          text: 'Halo! Ada yang bisa kami bantu?',
          ice_breakers: [{ title: 'Cek harga', response: 'Produk mana yang kamu minati?' }],
        },
      },
    };

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_426223085194693',
      name: 'IG Reel DM 01',
      instagramUserId: '17841421517309865',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18170919886430243',
          callToAction: 'INSTAGRAM_MESSAGE',
          appDestination: 'INSTAGRAM_DIRECT',
          destinationUrl: 'https://www.instagram.com/',
          pageWelcomeMessage,
        },
      },
    });

    expect(mockMetaPost).not.toHaveBeenCalled();
    expect(result.status).toBe('dry_run');
    expect(result.preview).toEqual({
      name: 'IG Reel DM 01',
      source_instagram_media_id: '18170919886430243',
      instagram_user_id: '17841421517309865',
      call_to_action: {
        type: 'INSTAGRAM_MESSAGE',
        value: {
          app_destination: 'INSTAGRAM_DIRECT',
          link: 'https://www.instagram.com/',
        },
      },
      page_welcome_message: pageWelcomeMessage,
    });
    expect(result.preview.object_story_spec).toBeUndefined();
  });

  it('previews an existing Instagram WhatsApp Reel without CTA link', async () => {
    const pageWelcomeMessage = {
      type: 'VISUAL_EDITOR',
      text_format: {
        message: { text: 'Halo Pak Ivan, saya tertarik dengan Hurricane XCS.' },
      },
    };

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_426223085194693',
      name: 'HRC01 | REELS | CTWA',
      pageId: '330290916841848',
      instagramUserId: '17841449623015969',
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          pageWelcomeMessage,
        },
      },
    });

    expect(mockMetaPost).not.toHaveBeenCalled();
    expect(result.status).toBe('dry_run');
    expect(result.preview).toEqual({
      name: 'HRC01 | REELS | CTWA',
      source_instagram_media_id: '18571075747064659',
      instagram_user_id: '17841449623015969',
      call_to_action: {
        type: 'WHATSAPP_MESSAGE',
        value: {
          app_destination: 'WHATSAPP',
          link: 'https://api.whatsapp.com/send',
        },
      },
      page_welcome_message: pageWelcomeMessage,
    });
  });

  it('normalizes existing Instagram WhatsApp Reel CTA links to the Ads Manager send URL', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_426223085194693',
      name: 'HRC01 | REELS | CTWA',
      instagramUserId: '17841449623015969',
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          destinationUrl: 'https://wa.me/6285156583372',
        },
      },
    });

    expect(result.status).toBe('dry_run');
    expect(result.preview).toMatchObject({
      call_to_action: {
        type: 'WHATSAPP_MESSAGE',
        value: {
          app_destination: 'WHATSAPP',
          link: 'https://api.whatsapp.com/send',
        },
      },
    });
  });

  it('keeps existing Instagram WhatsApp Reel CTA value when appDestination is supplied', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_426223085194693',
      name: 'HRC01 | REELS | CTWA',
      instagramUserId: '17841449623015969',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: {
          sourceInstagramMediaId: '18571075747064659',
          callToAction: 'WHATSAPP_MESSAGE',
          appDestination: 'WHATSAPP',
          destinationUrl: 'https://wa.me/6285156583372',
        },
      },
    });

    expect(result.status).toBe('dry_run');
    expect(result.preview).toMatchObject({
      call_to_action: {
        type: 'WHATSAPP_MESSAGE',
        value: {
          app_destination: 'WHATSAPP',
          link: 'https://api.whatsapp.com/send',
        },
      },
    });
  });

  it.each([
    { objective: 'OUTCOME_SALES' as const, callToAction: 'SHOP_NOW' },
    { objective: 'OUTCOME_TRAFFIC' as const, callToAction: 'LEARN_MORE' },
    { objective: 'OUTCOME_LEADS' as const, callToAction: 'SIGN_UP' },
  ])(
    'boosts an existing post under $objective without a launch-matrix rejection',
    async ({ objective, callToAction }) => {
      const result = await createAdCreative(mockClient, {
        adAccountId: 'act_1',
        name: `EP ${objective} 01`,
        objective,
        conversionLocation: 'WEBSITE',
        creative: {
          creativeFormat: 'existing_post',
          creativeSpec: {
            objectStoryId: 'page-1_123',
            destinationUrl: 'https://shop.example.com/product',
            callToAction,
          },
        },
      });

      expect(result.status).toBe('dry_run');
      expect(result.preview).toMatchObject({
        object_story_id: 'page-1_123',
        call_to_action: {
          type: callToAction,
          value: { link: 'https://shop.example.com/product' },
        },
      });
      expect(result.preview.object_story_spec).toBeUndefined();
    }
  );

  // destinationMode resolves to EXTERNAL_URL for every Website row, so the
  // URL that carries the CTA must still be mandatory when boosting a post.
  it('still requires destinationUrl when boosting a post for Website Traffic', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_1',
      name: 'EP Traffic no URL',
      objective: 'OUTCOME_TRAFFIC',
      conversionLocation: 'WEBSITE',
      creative: {
        creativeFormat: 'existing_post',
        creativeSpec: { objectStoryId: 'page-1_123' },
      },
    });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/destinationUrl wajib diisi/i);
    expect(mockMetaPost).not.toHaveBeenCalled();
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
      threads_user_id: 'threads_456',
    });
  });

  it('carries Threads identity through the creative (creativeFormat) path', async () => {
    // Regression: threadsProfileId was only honoured on the legacy linkData
    // branch. On the creative path it was accepted, validated as a known param,
    // then dropped before the payload was built — no error, no warning.
    const r = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Single image with Threads identity',
      pageId: '1001',
      instagramUserId: 'ig_123',
      threadsProfileId: 'threads_456',
      creative: {
        creativeFormat: 'single_image',
        creativeSpec: {
          imageHash: 'hash_abc',
          primaryText: 'Buy now',
          headline: 'Great deal',
          destinationUrl: 'https://example.com',
          callToAction: 'SHOP_NOW',
        },
      },
    });

    expect(r.preview.object_story_spec).toMatchObject({
      instagram_user_id: 'ig_123',
      threads_user_id: 'threads_456',
    });
  });

  it('rejects nested asset_feed_spec instead of moving it into a Dynamic Creative payload', async () => {
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

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: { code: 'DYNAMIC_CREATIVE_DISABLED' },
    });
    expect(result.error).toMatch(/manual creative\/ad/i);
  });

  it('rejects legacy nested asset_feed_spec Dynamic Creative creation', async () => {
    const assetFeedSpec = {
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
    };

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

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: { code: 'DYNAMIC_CREATIVE_DISABLED' },
    });
    expect(result.error).toMatch(/manual creative\/ad/i);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects top-level assetFeedSpec Dynamic Creative creation', async () => {
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

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: { code: 'DYNAMIC_CREATIVE_DISABLED' },
    });
    expect(result.error).toMatch(/manual creative\/ad/i);
  });

  it('allows placement-customized video assetFeedSpec without Dynamic Creative', async () => {
    const assetFeedSpec = {
      ad_formats: ['SINGLE_VIDEO'],
      videos: [
        { video_id: 'video_feed', adlabels: [{ name: 'placement_feed_video' }] },
        { video_id: 'video_vertical', adlabels: [{ name: 'placement_vertical_video' }] },
      ],
      bodies: [{ text: 'Primary text' }],
      titles: [{ text: 'Headline' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
      call_to_action_types: ['LEARN_MORE'],
      asset_customization_rules: [
        {
          video_label: { name: 'placement_feed_video' },
          customization_spec: {
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['feed'],
            instagram_positions: ['stream'],
          },
        },
        {
          video_label: { name: 'placement_vertical_video' },
          customization_spec: {
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['story', 'facebook_reels'],
            instagram_positions: ['story', 'reels'],
          },
        },
      ],
    };

    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Placement video creative',
      pageId: '1001',
      objectStorySpec: { page_id: '1001' },
      assetFeedSpec,
    });

    expect(result).toMatchObject({
      status: 'dry_run',
      preview: {
        object_story_spec: { page_id: '1001' },
        asset_feed_spec: assetFeedSpec,
      },
    });
  });

  it('rejects creativeFormat flexible Dynamic Creative creation', async () => {
    const result = await createAdCreative(mockClient, {
      adAccountId: 'act_123',
      name: 'Flexible Dynamic Creative',
      pageId: '1001',
      creative: {
        creativeFormat: 'flexible',
        creativeSpec: {
          primaryText: 'Primary text',
          primaryTexts: ['Primary text', 'Alt text'],
          imageHashes: ['image_hash_1'],
          headlines: ['Headline A', 'Headline B'],
          destinationUrl: 'https://example.com/product',
        },
      },
    });

    expect(result).toMatchObject({
      status: 'failed',
      structuredError: { code: 'DYNAMIC_CREATIVE_DISABLED' },
    });
    expect(result.error).toMatch(/manual creative\/ad/i);
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
          'id,name,object_story_id,object_story_spec,asset_feed_spec,platform_customizations,portrait_customizations,degrees_of_freedom_spec,media_sourcing_spec,product_set_id,omnichannel_link_spec,effective_object_story_id,source_instagram_media_id,url_tags,instagram_user_id,threads_user_id',
      },
      3
    );
  });

  it('verifies exact url_tags after creating a legacy manual video', async () => {
    const urlTags =
      'utm_source={{site_source_name}}&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.id}}';
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-manual-video' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-manual-video',
      object_story_spec: {
        video_data: {
          video_id: 'video-1',
          image_hash: 'image-1',
          message: 'Manual video',
        },
      },
      url_tags: urlTags,
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Manual video with UTM',
        pageId: '215116488342403',
        urlTags,
        objectStorySpec: {
          video_data: {
            video_id: 'video-1',
            image_hash: 'image-1',
            message: 'Manual video',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'executed',
      verification: {
        status: 'verified',
        creativeId: 'creative-manual-video',
        effectiveFormat: 'video',
        summary: {
          urlTagsStatus: 'verified',
        },
      },
    });
    expect(mockMetaGetObject).toHaveBeenCalledWith(
      '/creative-manual-video',
      {
        fields: expect.stringContaining('url_tags'),
      },
      3
    );
  });

  it('reports the Instagram/Threads identity as verified when Meta reads it back', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-identity-ok' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-identity-ok',
      object_story_spec: {
        instagram_user_id: 'ig-1',
        threads_user_id: 'threads-1',
        link_data: { image_hash: 'image-1', link: 'https://example.com', message: 'Halo' },
      },
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Identity read-back',
        pageId: '215116488342403',
        instagramUserId: 'ig-1',
        threadsProfileId: 'threads-1',
        creative: {
          creativeFormat: 'single_image',
          creativeSpec: {
            imageHash: 'image-1',
            primaryText: 'Halo',
            destinationUrl: 'https://example.com',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result.verification).toMatchObject({
      status: 'verified',
      summary: { identityStatus: 'verified' },
    });
    expect(mockMetaGetObject).toHaveBeenCalledWith(
      '/creative-identity-ok',
      { fields: expect.stringContaining('threads_user_id') },
      3
    );
  });

  it('warns when Meta silently drops the Threads identity on read-back', async () => {
    // The exact failure this branch exists to catch: Meta accepts the payload,
    // returns 200, and the identity is simply not there when read back.
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-identity-dropped' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-identity-dropped',
      object_story_spec: {
        instagram_user_id: 'ig-1',
        link_data: { image_hash: 'image-1', link: 'https://example.com', message: 'Halo' },
      },
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Identity dropped',
        pageId: '215116488342403',
        instagramUserId: 'ig-1',
        threadsProfileId: 'threads-1',
        creative: {
          creativeFormat: 'single_image',
          creativeSpec: {
            imageHash: 'image-1',
            primaryText: 'Halo',
            destinationUrl: 'https://example.com',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    // Reported, never a verdict: the creative was really created, so the
    // verification stays 'verified' and only carries the identity warning.
    expect(result.status).toBe('executed');
    expect(result.verification).toMatchObject({
      status: 'verified',
      summary: { identityStatus: 'missing' },
    });
    expect(result.verification?.warning).toMatch(/identitas Instagram\/Threads/i);
  });

  it('never fails a strict-path creative just because the identity was not echoed back', async () => {
    // GUARD — do not re-wire identityStatus into the verified gate.
    // placement_image and video CTWA escalate any non-'verified' verification to
    // status 'failed'. Meta legitimately declines to echo threads_user_id on
    // creatives that really are serving on Threads: docs/meta/threads-ads-identity.md
    // states it "akan terbaca kosong ... kosong di sini bukan berarti gagal",
    // backed by live delivery evidence on act_1417353822551653. Failing here
    // would report a creative that Meta actually created as failed, pushing
    // callers to retry and duplicate it.
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-placement' });
    mockMetaGetObject.mockResolvedValueOnce(placementReadBack);

    const placementResult = await createAdCreative(
      mockClient,
      { ...placementImageOptions, threadsProfileId: 'threads-1' },
      { dryRun: false, confirmed: true }
    );

    expect(placementResult.status).toBe('executed');
    expect(placementResult.error).toBeUndefined();
    expect(placementResult.verification).toMatchObject({
      status: 'verified',
      summary: { identityStatus: 'missing' },
    });
    expect(placementResult.verification?.warning).toMatch(/identitas Instagram\/Threads/i);

    mockMetaPost.mockResolvedValueOnce({ id: 'creative-video-ctwa-no-threads' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-video-ctwa-no-threads',
      object_story_spec: {
        instagram_user_id: '17841463380041722',
        video_data: {
          video_id: '2477639949641639',
          image_hash: '510512f2214a70ee799ea43334d2d172',
          message: 'Chat Meena Beauty',
          call_to_action: {
            type: 'WHATSAPP_MESSAGE',
            value: { link: 'https://api.whatsapp.com/send' },
          },
          page_welcome_message: 'Halo, ada yang bisa kami bantu?',
        },
      },
    });

    const ctwaResult = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Meena | Video CTWA tanpa echo Threads',
        pageId: '215116488342403',
        instagramUserId: '17841463380041722',
        threadsProfileId: 'threads-1',
        creative: {
          creativeFormat: 'video',
          creativeSpec: {
            videoId: '2477639949641639',
            thumbnailImageHash: '510512f2214a70ee799ea43334d2d172',
            primaryText: 'Chat Meena Beauty',
            destinationUrl: 'https://api.whatsapp.com/send',
            callToAction: 'WHATSAPP_MESSAGE',
            pageWelcomeMessage: 'Halo, ada yang bisa kami bantu?',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(ctwaResult.status).toBe('executed');
    expect(ctwaResult.error).toBeUndefined();
    expect(ctwaResult.verification).toMatchObject({
      status: 'verified',
      summary: { identityStatus: 'missing', videoCtwaStatus: 'verified' },
    });
    expect(ctwaResult.verification?.warning).toMatch(/identitas Instagram\/Threads/i);
  });

  it('omits threads_user_id from the read-back on API versions below the supported floor', async () => {
    // Same combined-request hazard as getMetaCreativeFields: one unsupported
    // field 400s the entire read-back.
    const legacyClient = {
      metaPost: mockMetaPost,
      metaGet: mockMetaGet,
      metaGetObject: mockMetaGetObject,
      apiVersion: 'v20.0',
    } as unknown as MetaClient;
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-legacy-readback' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-legacy-readback',
      object_story_spec: {
        link_data: { image_hash: 'image-1', link: 'https://example.com', message: 'Halo' },
      },
    });

    await createAdCreative(legacyClient, standardImageOptions, {
      dryRun: false,
      confirmed: true,
    });

    const requestedFields = String(mockMetaGetObject.mock.calls.at(-1)?.[1]?.fields);
    expect(requestedFields).not.toContain('threads_user_id');
    expect(requestedFields).toContain('instagram_user_id');
  });

  it('leaves identityStatus not_requested when no identity was sent', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-no-identity' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-no-identity',
      object_story_spec: {
        link_data: { image_hash: 'image-1', link: 'https://example.com', message: 'Halo' },
      },
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'No identity',
        pageId: '215116488342403',
        creative: {
          creativeFormat: 'single_image',
          creativeSpec: {
            imageHash: 'image-1',
            primaryText: 'Halo',
            destinationUrl: 'https://example.com',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result.verification).toMatchObject({
      status: 'verified',
      summary: { identityStatus: 'not_requested' },
    });
  });

  it('verifies a root-level identity read back outside object_story_spec', async () => {
    // The sourceInstagramMediaId path builds no object_story_spec at all, so the
    // identity lives at the payload root in both directions.
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-root-identity' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-root-identity',
      source_instagram_media_id: 'ig-media-1',
      instagram_user_id: 'ig-1',
      threads_user_id: 'threads-1',
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Root identity',
        pageId: '215116488342403',
        instagramUserId: 'ig-1',
        threadsProfileId: 'threads-1',
        creative: {
          creativeFormat: 'existing_post',
          creativeSpec: { sourceInstagramMediaId: 'ig-media-1' },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result.verification?.summary).toMatchObject({ identityStatus: 'verified' });
  });

  it('verifies video CTWA CTA link and welcome message before returning it as ready', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-video-ctwa' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-video-ctwa',
      object_story_spec: {
        // Meta echoes the pinned identity back on the creative; the read-back
        // mock mirrors that so identityStatus resolves to 'verified'.
        instagram_user_id: '17841463380041722',
        video_data: {
          video_id: '2477639949641639',
          image_hash: '510512f2214a70ee799ea43334d2d172',
          message: 'Chat Meena Beauty',
          call_to_action: {
            type: 'WHATSAPP_MESSAGE',
            value: { link: 'https://api.whatsapp.com/send' },
          },
          page_welcome_message: 'Halo, ada yang bisa kami bantu?',
        },
      },
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Meena | Video CTWA',
        pageId: '215116488342403',
        instagramUserId: '17841463380041722',
        creative: {
          creativeFormat: 'video',
          creativeSpec: {
            videoId: '2477639949641639',
            thumbnailImageHash: '510512f2214a70ee799ea43334d2d172',
            primaryText: 'Chat Meena Beauty',
            destinationUrl: 'https://api.whatsapp.com/send',
            callToAction: 'WHATSAPP_MESSAGE',
            pageWelcomeMessage: 'Halo, ada yang bisa kami bantu?',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'executed',
      verification: {
        status: 'verified',
        effectiveFormat: 'video',
        summary: { videoCtwaStatus: 'verified' },
      },
    });
  });

  it('fails safely when Meta strips video CTWA CTA fields on read-back', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-video-ctwa-stripped' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-video-ctwa-stripped',
      object_story_spec: {
        video_data: {
          video_id: '2477639949641639',
          image_hash: '510512f2214a70ee799ea43334d2d172',
          message: 'Chat Meena Beauty',
          call_to_action: { type: 'WHATSAPP_MESSAGE' },
        },
      },
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Meena | Video CTWA',
        pageId: '215116488342403',
        creative: {
          creativeFormat: 'video',
          creativeSpec: {
            videoId: '2477639949641639',
            thumbnailImageHash: '510512f2214a70ee799ea43334d2d172',
            primaryText: 'Chat Meena Beauty',
            destinationUrl: 'https://api.whatsapp.com/send',
            callToAction: 'WHATSAPP_MESSAGE',
            pageWelcomeMessage: 'Halo, ada yang bisa kami bantu?',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result).toMatchObject({
      status: 'failed',
      executed: true,
      verification: {
        status: 'warning',
        summary: { videoCtwaStatus: 'missing_cta_link' },
      },
      error: expect.stringMatching(/Jangan lanjutkan creative ini menjadi ad/i),
    });
  });

  it('warns when Meta omits requested url_tags from a legacy manual video', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'creative-without-utm' });
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'creative-without-utm',
      object_story_spec: {
        video_data: {
          video_id: 'video-1',
          image_hash: 'image-1',
          message: 'Manual video',
        },
      },
    });

    const result = await createAdCreative(
      mockClient,
      {
        adAccountId: 'act_2086409658377471',
        name: 'Manual video missing UTM',
        pageId: '215116488342403',
        urlTags: 'utm_source={{site_source_name}}',
        objectStorySpec: {
          video_data: {
            video_id: 'video-1',
            image_hash: 'image-1',
            message: 'Manual video',
          },
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(result.verification).toMatchObject({
      status: 'warning',
      effectiveFormat: 'video',
      summary: {
        urlTagsStatus: 'missing',
      },
      warning: expect.stringMatching(/url_tags.*tidak ditemukan/i),
    });
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

  describe('partnership (Meta Partnership Ads)', () => {
    const partnershipOptions = {
      ...standardImageOptions,
      partnership: {
        partnerPageId: 'creator-page-1',
        partnerInstagramId: 'creator-ig-1',
      },
    };

    // Uji lintas-lapisan: menembak createAdCreative (bukan modul murni) untuk
    // ketiga jalur pembuatan yang didokumentasikan Meta, dengan bentuk payload
    // persis seperti contoh resmi. Cacat F1/F2/F4/F6 lolos enam review per-task
    // justru karena tidak ada uji yang menyeberangi lapisan pada jalur-jalur ini.
    describe('bentuk payload ketiga jalur pembuatan', () => {
      it('boost via media ID: object_id + source_instagram_media_id + identitas branded content', async () => {
        const result = await createAdCreative(mockClient, {
          adAccountId: 'act_123',
          name: 'Boost media',
          pageId: 'brand-page-1',
          instagramUserId: 'creator-ig-1',
          creative: {
            creativeFormat: 'existing_post' as const,
            creativeSpec: { sourceInstagramMediaId: 'ig-media-1' },
          },
          partnership: {
            partnerPageId: 'creator-page-1',
            partnerInstagramId: 'creator-ig-1',
            adFormat: '1',
          },
        });

        expect(result.status).toBe('dry_run');
        expect(result.preview).toEqual({
          name: 'Boost media',
          object_id: 'brand-page-1',
          source_instagram_media_id: 'ig-media-1',
          instagram_user_id: 'creator-ig-1',
          facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
          instagram_branded_content: { sponsor_id: 'creator-ig-1' },
          branded_content: { ad_format: '1' },
        });
      });

      it('boost via ad code: object_id + branded_content, tanpa referensi konten lain', async () => {
        const result = await createAdCreative(mockClient, {
          adAccountId: 'act_123',
          name: 'Boost ad code',
          pageId: 'brand-page-1',
          creative: {
            creativeFormat: 'existing_post' as const,
            creativeSpec: {},
          },
          partnership: {
            partnerPageId: 'creator-page-1',
            partnerInstagramId: 'creator-ig-1',
            adCode: 'AD-CODE-XYZ',
            adFormat: '1',
          },
        });

        expect(result.status).toBe('dry_run');
        expect(result.preview).toEqual({
          name: 'Boost ad code',
          object_id: 'brand-page-1',
          branded_content: {
            instagram_boost_post_access_token: 'AD-CODE-XYZ',
            ad_format: '1',
          },
          facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
          instagram_branded_content: { sponsor_id: 'creator-ig-1' },
        });
      });

      it('creative baru dual-identity dengan brand sebagai identitas primer', async () => {
        const result = await createAdCreative(mockClient, {
          ...standardImageOptions,
          pageId: 'brand-page-1',
          partnership: {
            partnerPageId: 'creator-page-1',
            partnerInstagramId: 'creator-ig-1',
          },
        });

        expect(result.status).toBe('dry_run');
        expect(result.preview).toMatchObject({
          object_story_spec: { page_id: 'brand-page-1' },
          facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
          instagram_branded_content: { sponsor_id: 'creator-ig-1' },
        });
        expect(result.preview).not.toHaveProperty('object_id');
        expect(result.preview).not.toHaveProperty('branded_content');
      });

      it('creative baru dual-identity dengan kreator sebagai identitas primer', async () => {
        const result = await createAdCreative(mockClient, {
          ...standardImageOptions,
          pageId: 'brand-page-1',
          partnership: {
            partnerPageId: 'creator-page-1',
            brandInstagramId: 'brand-ig-1',
            primaryIdentity: 'creator' as const,
          },
        });

        expect(result.status).toBe('dry_run');
        expect(result.preview).toMatchObject({
          object_story_spec: { page_id: 'creator-page-1' },
          facebook_branded_content: { sponsor_page_id: 'brand-page-1' },
          instagram_branded_content: { sponsor_id: 'brand-ig-1' },
        });
        expect(result.partnershipNotes).toEqual(
          expect.arrayContaining([expect.stringContaining('pending delivery')])
        );
      });

      it('existing_post via objectStoryId tidak membawa object_id kedua', async () => {
        const result = await createAdCreative(mockClient, {
          adAccountId: 'act_123',
          name: 'Boost post FB',
          pageId: 'brand-page-1',
          creative: {
            creativeFormat: 'existing_post' as const,
            creativeSpec: { objectStoryId: 'creator-page-1_123' },
          },
          partnership: { partnerPageId: 'creator-page-1' },
        });

        expect(result.status).toBe('dry_run');
        expect(result.preview).toEqual({
          name: 'Boost post FB',
          object_story_id: 'creator-page-1_123',
          facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
        });
      });

      it('adFormat tanpa adCode tetap menghasilkan branded_content pada creative baru', async () => {
        const result = await createAdCreative(mockClient, {
          ...standardImageOptions,
          pageId: 'brand-page-1',
          partnership: {
            partnerPageId: 'creator-page-1',
            adFormat: '2',
          },
        });

        expect(result.preview).toMatchObject({ branded_content: { ad_format: '2' } });
      });
    });

    it('surfaces partnershipNotes on a dry_run result', async () => {
      const result = await createAdCreative(mockClient, partnershipOptions);

      expect(result.status).toBe('dry_run');
      expect(result.preview).toMatchObject({
        facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
        instagram_branded_content: { sponsor_id: 'creator-ig-1' },
      });
      expect(result.partnershipNotes).toEqual(
        expect.arrayContaining([expect.stringContaining('pending delivery')])
      );
    });

    it('carries partnershipNotes through to an executed result via baseResult', async () => {
      mockMetaPost.mockResolvedValueOnce({ id: 'creative-partnership-1' });
      mockMetaGetObject.mockResolvedValueOnce({
        id: 'creative-partnership-1',
        object_story_spec: { link_data: { image_hash: 'image-hash-1' } },
      });

      const result = await createAdCreative(mockClient, partnershipOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('executed');
      expect(result.id).toBe('creative-partnership-1');
      expect(result.partnershipNotes).toEqual(
        expect.arrayContaining([expect.stringContaining('pending delivery')])
      );
    });

    it('menolak partnership pada jalur legacy linkData alih-alih membuangnya diam-diam', async () => {
      const result = await createAdCreative(mockClient, {
        ...baseOpts,
        partnership: { partnerPageId: 'creator-page-1' },
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/partnership/);
      expect(result.error).toMatch(/creativeSpec|creativeFormat/);
      expect(result.preview).not.toHaveProperty('facebook_branded_content');
    });

    it('menolak partnership pada jalur legacy objectStorySpec', async () => {
      const result = await createAdCreative(mockClient, {
        adAccountId: 'act_123',
        name: 'Legacy story spec',
        pageId: '1001',
        objectStorySpec: {
          link_data: { link: 'https://example.com', message: 'Halo' },
        },
        partnership: { partnerPageId: 'creator-page-1' },
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/partnership/);
      expect(result.preview).not.toHaveProperty('facebook_branded_content');
    });

    it('menyarankan scope branded content saat creative partnership ditolak dengan kode 200', async () => {
      mockMetaPost.mockRejectedValueOnce(
        new MetaApiError({
          message: 'Permissions error',
          type: 'OAuthException',
          code: 200,
          fbtrace_id: 'trace-partnership-200',
        })
      );

      const result = await createAdCreative(mockClient, partnershipOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/instagram_branded_content_ads_brand/);
    });

    it('tidak menyarankan scope branded content saat creative biasa ditolak dengan kode 200', async () => {
      mockMetaPost.mockRejectedValueOnce(
        new MetaApiError({
          message: 'Permissions error',
          type: 'OAuthException',
          code: 200,
          fbtrace_id: 'trace-plain-200',
        })
      );

      const result = await createAdCreative(mockClient, standardImageOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('failed');
      expect(result.error).not.toMatch(/branded_content/);
    });

    it('omits partnershipNotes when partnership is not used', async () => {
      const result = await createAdCreative(mockClient, standardImageOptions);

      expect(result.status).toBe('dry_run');
      expect(result.partnershipNotes).toBeUndefined();
    });
  });
});
