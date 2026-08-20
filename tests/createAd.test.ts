import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAd } from '../src/tools/createAd.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createAd', () => {
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
    name: 'Test Ad',
    adSetId: 'as456',
    creativeId: 'c789',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockMetaGet.mockResolvedValue({ data: [] });
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : { asset_feed_spec: null }
    );
  });

  it('returns dry_run without calling API', async () => {
    const r = await createAd(mockClient, baseOpts);
    expect(r.status).toBe('dry_run');
    expect(r.preview.adset_id).toBe('as456');
    expect(r.preview.creative).toContain('c789');
    expect(r.preview.status).toBe('PAUSED');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('builds a non-Dynamic inline multi-media CTWA creative with per-image placement exclusions', async () => {
    const r = await createAd(mockClient, {
      adAccountId: 'act_123',
      name: 'Five-image CTWA',
      adSetId: 'as456',
      multiMedia: {
        pageId: 'page-1',
        instagramUserId: 'ig-1',
        destinationUrl: 'https://api.whatsapp.com/send',
        primaryImageHash: 'image-1',
        primaryText: 'Chat with us',
        headline: 'Five images',
        callToAction: 'WHATSAPP_MESSAGE',
        images: [
          {
            imageHash: 'image-1',
            placementExclusions: [
              { publisherPlatform: 'instagram', positions: ['story', 'reels'] },
            ],
          },
          {
            imageHash: 'image-2',
            placementExclusions: [{ publisherPlatform: 'instagram', positions: ['stream'] }],
          },
        ],
      },
    });

    expect(r.status).toBe('dry_run');
    expect(JSON.parse(r.preview.creative as string)).toEqual({
      object_story_spec: {
        page_id: 'page-1',
        instagram_user_id: 'ig-1',
        link_data: {
          link: 'https://api.whatsapp.com/send',
          message: 'Chat with us',
          name: 'Five images',
          image_hash: 'image-1',
          call_to_action: { type: 'WHATSAPP_MESSAGE' },
        },
      },
      media_sourcing_spec: {
        bodies: [{ text: 'Chat with us' }],
        titles: [{ text: 'Five images' }],
        images: [
          {
            hash: 'image-1',
            source: 'multi_media',
            opt_in_status: 'opt_in',
            placement_customizations: [
              { publisher_platform: 'instagram', placement_exclusions: ['story', 'reels'] },
            ],
          },
          {
            hash: 'image-2',
            source: 'multi_media',
            opt_in_status: 'opt_in',
            placement_customizations: [
              { publisher_platform: 'instagram', placement_exclusions: ['stream'] },
            ],
          },
        ],
      },
    });
  });

  it('emits documented L1 and per-media text for the Meena multi-media reproduction shape', async () => {
    const r = await createAd(mockClient, {
      adAccountId: 'act_2086409658377471',
      name: 'MID MONTH SALE | POSTER | PLACEMENT 1:1 + 9:16 | 15-17 AGUSTUS 2026',
      adSetId: 'adset-meena',
      multiMedia: {
        pageId: 'page-meena',
        destinationUrl: 'https://api.whatsapp.com/send',
        primaryImageHash: 'dc83c36b21608b618107f7e88c0f8499',
        primaryText: 'Full Mid Month copy',
        headline: 'Mid Month headline',
        description: 'Mid Month description',
        callToAction: 'WHATSAPP_MESSAGE',
        images: [
          {
            imageHash: 'dc83c36b21608b618107f7e88c0f8499',
            placementExclusions: [
              { publisherPlatform: 'instagram', positions: ['story', 'reels'] },
            ],
            textCustomizations: {
              bodies: [{ text: 'Square primary text' }],
              titles: [{ text: 'Square headline' }],
              descriptions: [{ text: 'Square description' }],
            },
          },
          {
            imageHash: '5962cd721db94f092bded081a699b0bb',
            textCustomizations: {
              bodies: [{ text: 'Vertical primary text' }],
            },
          },
        ],
      },
    });

    const creative = JSON.parse(r.preview.creative as string);
    expect(creative.object_story_spec.link_data).toMatchObject({
      message: 'Full Mid Month copy',
      name: 'Mid Month headline',
      image_hash: 'dc83c36b21608b618107f7e88c0f8499',
    });
    expect(creative.media_sourcing_spec).toMatchObject({
      bodies: [{ text: 'Full Mid Month copy' }],
      titles: [{ text: 'Mid Month headline' }],
      descriptions: [{ text: 'Mid Month description' }],
      images: [
        {
          hash: 'dc83c36b21608b618107f7e88c0f8499',
          source: 'multi_media',
          opt_in_status: 'opt_in',
          placement_customizations: [
            { publisher_platform: 'instagram', placement_exclusions: ['story', 'reels'] },
          ],
          text_customizations: {
            bodies: [{ text: 'Square primary text' }],
            titles: [{ text: 'Square headline' }],
            descriptions: [{ text: 'Square description' }],
          },
        },
        {
          hash: '5962cd721db94f092bded081a699b0bb',
          text_customizations: { bodies: [{ text: 'Vertical primary text' }] },
        },
      ],
    });
  });

  it('includes source_ad_id when an Ads Manager source ad supplies composer context', async () => {
    const r = await createAd(mockClient, {
      ...baseOpts,
      sourceAdId: 'source-ad-123',
    });

    expect(r).toMatchObject({
      status: 'dry_run',
      preview: {
        adset_id: 'as456',
        source_ad_id: 'source-ad-123',
      },
    });
    expect(JSON.parse(r.preview.creative as string)).toEqual({ creative_id: 'c789' });
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
    expect(r.executed).toBe(false);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('blocks at dry-run when an omnichannel ad set gets a non-omnichannel creative', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { promoted_object: { omnichannel_object: { app: [{ application_id: '1' }] } } }
        : { asset_feed_spec: { call_to_action_types: ['SHOP_NOW'] } }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('preflight_blocked');
    expect(r.error).toContain('applink_treatment');
    expect(r.error).toContain('object_store_urls');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('allows the omnichannel pairing through when skipOmnichannelCheck is set', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { promoted_object: { omnichannel_object: { app: [{ application_id: '1' }] } } }
        : { asset_feed_spec: {} }
    );

    const r = await createAd(mockClient, { ...baseOpts, skipOmnichannelCheck: true });

    expect(r.status).toBe('dry_run');
  });

  it('executes and returns id on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'ad123' });
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('executed');
    expect(r.id).toBe('ad123');
    const payload = mockMetaPost.mock.calls[0][1];
    expect(payload.adset_id).toBe('as456');
    expect(payload.status).toBe('PAUSED');
  });

  it('handles ACTIVE status', async () => {
    mockMetaPost.mockResolvedValueOnce({ id: 'ad124' });
    await createAd(
      mockClient,
      { ...baseOpts, status: 'ACTIVE' },
      { dryRun: false, confirmed: true }
    );
    expect(mockMetaPost.mock.calls[0][1].status).toBe('ACTIVE');
  });

  it('builds UI-style pixel tracking specs on the ad when pixelId is provided', async () => {
    const r = await createAd(mockClient, {
      ...baseOpts,
      pixelId: '607249154118091',
    });

    expect(r.status).toBe('dry_run');
    expect(r.preview.tracking_specs).toEqual([
      {
        'action.type': ['offsite_conversion'],
        fb_pixel: ['607249154118091'],
      },
    ]);
  });

  it('prefers explicit trackingSpecs over pixelId shorthand', async () => {
    const explicitTrackingSpecs = [
      {
        'action.type': ['offsite_conversion'],
        fb_pixel: ['custom-pixel'],
      },
    ];

    const r = await createAd(mockClient, {
      ...baseOpts,
      pixelId: '607249154118091',
      trackingSpecs: explicitTrackingSpecs,
    });

    expect(r.preview.tracking_specs).toBe(explicitTrackingSpecs);
  });

  it('blocks placement asset feeds on non-dynamic WhatsApp ad sets before mutation', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WHATSAPP', is_dynamic_creative: false }
        : { asset_feed_spec: { asset_customization_rules: [{ image_label: { name: 'feed' } }] } }
    );

    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });

    expect(r).toMatchObject({
      status: 'preflight_blocked',
      executed: false,
      error: expect.stringMatching(/WhatsApp.*placement|placement.*WhatsApp/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('blocks flexible multi-variant asset feeds on non-dynamic ad sets before mutation', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : {
            asset_feed_spec: {
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
              images: [{ hash: 'image_hash_1' }],
              link_urls: [{ website_url: 'https://example.com/product' }],
              call_to_action_types: ['LEARN_MORE'],
            },
          }
    );

    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });

    expect(r).toMatchObject({
      status: 'preflight_blocked',
      executed: false,
      error: expect.stringMatching(/optimization_type.*Dynamic Creative|DEGREES_OF_FREEDOM/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('surfaces flexible multi-variant incompatibility during dry-run', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : {
            asset_feed_spec: {
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
              images: [{ hash: 'image_hash_1' }],
              link_urls: [{ website_url: 'https://example.com/product' }],
              call_to_action_types: ['LEARN_MORE'],
            },
          }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('preflight_blocked');
    expect(r.error).toMatch(/optimization_type.*Dynamic Creative|DEGREES_OF_FREEDOM/i);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  // Regresi untuk klaim #1885274 yang dikarang. Bentuk payload di bawah disalin
  // dari ad set produksi (is_dynamic_creative:false) yang menjalankan empat ad
  // DEGREES_OF_FREEDOM berdampingan dengan satu ad manual/static — Meta menerima
  // kombinasi ini. Tidak ada aturan Meta yang melarang campuran format creative.
  it('allows a manual creative into an ad set that already runs DEGREES_OF_FREEDOM ads', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : {
            id: 'cr789',
            object_story_spec: {
              page_id: 'page_1',
              link_data: { image_hash: 'image_hash_1', link: 'https://example.com' },
            },
          }
    );
    mockMetaGet.mockResolvedValue({
      data: [
        {
          id: 'existing_advantage_ad_1',
          name: 'ADS Skincare malay 3',
          status: 'ACTIVE',
          creative: {
            id: 'existing_creative_1',
            asset_feed_spec: {
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
              optimization_type: 'DEGREES_OF_FREEDOM',
            },
          },
        },
      ],
    });

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('dry_run');
    expect(r.error).toBeUndefined();
  });

  it('allows a DEGREES_OF_FREEDOM creative into a non-dynamic ad set that already has ads', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : {
            id: 'cr789',
            asset_feed_spec: {
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
              optimization_type: 'DEGREES_OF_FREEDOM',
            },
          }
    );
    mockMetaGet.mockResolvedValue({
      data: [
        {
          id: 'existing_manual_ad_1',
          name: 'Existing Manual Creative',
          status: 'ACTIVE',
          creative: {
            id: 'existing_creative_1',
            object_story_spec: { page_id: 'page_1', link_data: { link: 'https://example.com' } },
          },
        },
      ],
    });

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('dry_run');
    expect(r.error).toBeUndefined();
  });

  it('falls back to asset_feed_spec when Meta rejects the wider compatibility field list', async () => {
    mockMetaGetObject.mockImplementation(async (path: string, params: Record<string, unknown>) => {
      if (path === '/as456') return { destination_type: 'WEBSITE', is_dynamic_creative: false };
      if (String(params.fields).includes('product_set_id')) {
        throw new Error('(#100) Tried accessing nonexisting field (product_set_id)');
      }
      return {
        asset_feed_spec: {
          bodies: [{ text: 'A' }, { text: 'B' }],
          optimization_type: 'DEGREES_OF_FREEDOM',
        },
      };
    });

    const r = await createAd(mockClient, baseOpts);

    // Tanpa fallback, createAd akan melempar dan bukan mengembalikan dry_run.
    expect(r.status).toBe('dry_run');
    expect(r.error).toBeUndefined();
  });

  it('does not invent a conflict when only part of the creative fields are readable', async () => {
    mockMetaGetObject.mockImplementation(async (path: string, params: Record<string, unknown>) => {
      if (String(params.fields).includes('template_data')) {
        throw new Error('Unsupported creative field template_data');
      }
      return path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : { object_story_spec: { page_id: 'page_1', link_data: { link: 'https://example.com' } } };
    });
    mockMetaGet.mockImplementation(async () => ({
      data: [
        {
          id: 'existing_advantage_ad_1',
          name: 'Existing Advantage+ text ad',
          status: 'ACTIVE',
          creative: {
            id: 'existing_creative_1',
            asset_feed_spec: {
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              optimization_type: 'DEGREES_OF_FREEDOM',
            },
          },
        },
      ],
    }));

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('dry_run');
    expect(JSON.stringify(r)).not.toContain('1885274');
  });

  // optimization_type REGULAR yang eksplisit adalah Dynamic Creative sungguhan,
  // dan itu tetap diblokir — persis seperti REGULAR yang di-default Meta.
  it('blocks an explicitly REGULAR asset-feed creative', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : {
            id: 'cr789',
            asset_feed_spec: {
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              optimization_type: 'REGULAR',
            },
          }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('preflight_blocked');
    expect(r.errorSource).toBe('local_preflight');
    expect(r.preflightCheck).toBe('placement_compatibility');
    expect(r.error).toMatch(/DEGREES_OF_FREEDOM/);
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  // Jejak audit: sebuah pre-flight lokal tidak boleh terbaca sebagai penolakan Meta.
  it('never labels a local pre-flight block as a Meta API rejection', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : { id: 'cr789', asset_feed_spec: { bodies: [{ text: 'a' }, { text: 'b' }] } }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('preflight_blocked');
    expect(r.status).not.toBe('failed');
    expect(r.errorSource).toBe('local_preflight');
    expect(r.structuredError).toBeUndefined();
    expect(mockMetaGetObject).toHaveBeenCalled();
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('blocks attaching a dynamic asset-feed creative to an ad set that already contains manual ads', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: true }
        : {
            asset_feed_spec: {
              ad_formats: ['AUTOMATIC_FORMAT'],
              bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
              titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
              images: [{ hash: 'image_hash_1' }],
              link_urls: [{ website_url: 'https://example.com/product' }],
              call_to_action_types: ['LEARN_MORE'],
            },
          }
    );
    mockMetaGet.mockResolvedValueOnce({
      data: [
        {
          id: 'existing_manual_ad_1',
          name: 'Existing Manual Creative',
          status: 'ACTIVE',
          creative: {
            id: 'existing_creative_1',
            object_story_spec: {
              page_id: 'page_1',
              link_data: { image_hash: 'image_hash_1', link: 'https://example.com' },
            },
          },
        },
      ],
    });

    const r = await createAd(mockClient, baseOpts);

    expect(r).toMatchObject({
      status: 'preflight_blocked',
      executed: false,
      error: expect.stringMatching(/manual.*dynamic|dynamic.*manual/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects a Dynamic Creative ad set even when it already contains only dynamic ads', async () => {
    const assetFeedSpec = {
      ad_formats: ['AUTOMATIC_FORMAT'],
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
      images: [{ hash: 'image_hash_1' }],
      link_urls: [{ website_url: 'https://example.com/product' }],
      call_to_action_types: ['LEARN_MORE'],
    };
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: true }
        : { asset_feed_spec: assetFeedSpec }
    );
    const r = await createAd(mockClient, baseOpts);

    expect(r).toMatchObject({
      status: 'preflight_blocked',
      executed: false,
      error: expect.stringMatching(/Dynamic Creative ad set.*disabled/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('does not allow a compatibility-check bypass to attach a dynamic creative', async () => {
    const dynamicAssetFeedSpec = {
      ad_formats: ['AUTOMATIC_FORMAT'],
      bodies: [{ text: 'Primary text A' }, { text: 'Primary text B' }],
      titles: [{ text: 'Headline A' }, { text: 'Headline B' }],
    };
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : { asset_feed_spec: dynamicAssetFeedSpec }
    );

    const r = await createAd(mockClient, {
      ...baseOpts,
      skipPlacementCompatibilityCheck: true,
      skipAdSetCreativeFamilyCheck: true,
    });

    expect(r).toMatchObject({
      status: 'preflight_blocked',
      executed: false,
      error: expect.stringMatching(/optimization_type.*Dynamic Creative|DEGREES_OF_FREEDOM/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('rejects a single-variant dynamic asset feed even when placement checks are skipped', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : {
            asset_feed_spec: {
              ad_formats: ['AUTOMATIC_FORMAT'],
              bodies: [{ text: 'Only primary text' }],
              titles: [{ text: 'Only headline' }],
              images: [{ hash: 'image_hash_1' }, { hash: 'image_hash_2' }],
            },
          }
    );

    const r = await createAd(mockClient, {
      ...baseOpts,
      skipPlacementCompatibilityCheck: true,
      skipAdSetCreativeFamilyCheck: true,
    });

    expect(r).toMatchObject({
      status: 'preflight_blocked',
      executed: false,
      error: expect.stringMatching(/optimization_type.*Dynamic Creative/i),
    });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('accepts the retired skipAdSetCreativeFamilyCheck flag and says it is a no-op', async () => {
    const r = await createAd(mockClient, { ...baseOpts, skipAdSetCreativeFamilyCheck: true });

    expect(r.status).toBe('dry_run');
    expect(r.warnings?.join(' ')).toMatch(/tidak berlaku dan diabaikan/i);
    expect(r.warnings?.join(' ')).toContain('1885274');
  });

  it('allows placement compatibility bypass with an explicit warning', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WHATSAPP', is_dynamic_creative: false }
        : { asset_feed_spec: { asset_customization_rules: [{ image_label: { name: 'feed' } }] } }
    );
    mockMetaPost.mockResolvedValueOnce({ id: 'ad-bypass-1' });

    const r = await createAd(
      mockClient,
      { ...baseOpts, skipPlacementCompatibilityCheck: true },
      { dryRun: false, confirmed: true }
    );

    expect(r).toMatchObject({
      status: 'executed',
      executed: true,
      id: 'ad-bypass-1',
      warnings: [expect.stringMatching(/placement.*compatibility.*skipped/i)],
    });
    expect(mockMetaPost).toHaveBeenCalledTimes(1);
  });

  it('does not create a duplicate ad when dedupeByName finds an existing one', async () => {
    // Satu-satunya metaGet di jalur ini adalah lookup dedupe: pre-flight yang
    // dulu memindai /{adset}/ads sudah dihapus bersama guard "campuran format".
    mockMetaGet.mockResolvedValueOnce({
      data: [{ id: 'existing_ad_1', name: 'Test Ad', status: 'PAUSED' }],
    });

    const r = await createAd(
      mockClient,
      {
        ...baseOpts,
        dedupeByName: true,
      },
      { dryRun: false, confirmed: true }
    );

    expect(mockMetaGet).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('deduped');
    expect(r.executed).toBe(false);
    expect(r.id).toBe('existing_ad_1');
    expect(mockMetaGet.mock.calls[0][1]).not.toHaveProperty('filtering');
    expect(mockMetaGet.mock.calls[0][2]).toMatchObject({ paginate: true, maxPages: 20 });
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  // An INSTAGRAM_DIRECT ad set paired with a MESSAGE_PAGE creative (the Messenger CTA)
  // was accepted without complaint on 2026-07-26. One cross-check prevents the class.
  const messagingMismatches: Array<{ destinationType: string; ctaType: string }> = [
    { destinationType: 'INSTAGRAM_DIRECT', ctaType: 'MESSAGE_PAGE' },
    { destinationType: 'MESSENGER', ctaType: 'INSTAGRAM_MESSAGE' },
    { destinationType: 'WHATSAPP', ctaType: 'INSTAGRAM_MESSAGE' },
    { destinationType: 'MESSAGING_MESSENGER_WHATSAPP', ctaType: 'INSTAGRAM_MESSAGE' },
    { destinationType: 'INSTAGRAM_DIRECT', ctaType: 'LEARN_MORE' },
  ];

  it.each(messagingMismatches)(
    'blocks at dry-run when a $destinationType ad set gets a $ctaType creative',
    async ({ destinationType, ctaType }) => {
      mockMetaGetObject.mockImplementation(async (path: string) =>
        path === '/as456'
          ? { destination_type: destinationType, is_dynamic_creative: false }
          : { call_to_action: { type: ctaType } }
      );

      const r = await createAd(mockClient, baseOpts);

      expect(r.status).toBe('preflight_blocked');
      expect(r.error).toContain(destinationType);
      expect(r.error).toContain(ctaType);
      expect(mockMetaPost).not.toHaveBeenCalled();
    }
  );

  const messagingMatches: Array<{ destinationType: string; ctaType: string }> = [
    { destinationType: 'INSTAGRAM_DIRECT', ctaType: 'INSTAGRAM_MESSAGE' },
    { destinationType: 'MESSENGER', ctaType: 'MESSAGE_PAGE' },
    { destinationType: 'WHATSAPP', ctaType: 'WHATSAPP_MESSAGE' },
    { destinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER', ctaType: 'INSTAGRAM_MESSAGE' },
    { destinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER', ctaType: 'MESSAGE_PAGE' },
    {
      destinationType: 'MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP',
      ctaType: 'WHATSAPP_MESSAGE',
    },
  ];

  it.each(messagingMatches)(
    'allows a $destinationType ad set paired with a $ctaType creative',
    async ({ destinationType, ctaType }) => {
      mockMetaGetObject.mockImplementation(async (path: string) =>
        path === '/as456'
          ? { destination_type: destinationType, is_dynamic_creative: false }
          : { call_to_action: { type: ctaType } }
      );

      const r = await createAd(mockClient, baseOpts);

      expect(r.status).toBe('dry_run');
    }
  );

  it('blocks at dry-run when app_destination contradicts the ad set destination', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'INSTAGRAM_DIRECT', is_dynamic_creative: false }
        : {
            call_to_action: {
              type: 'INSTAGRAM_MESSAGE',
              value: { app_destination: 'WHATSAPP' },
            },
          }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('preflight_blocked');
    expect(r.error).toMatch(/app_destination/i);
  });

  it('leaves non-messaging ad sets to Meta', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'WEBSITE', is_dynamic_creative: false }
        : { call_to_action: { type: 'INSTAGRAM_MESSAGE' } }
    );

    const r = await createAd(mockClient, baseOpts);

    expect(r.status).toBe('dry_run');
  });

  it('skips the messaging cross-check when asked', async () => {
    mockMetaGetObject.mockImplementation(async (path: string) =>
      path === '/as456'
        ? { destination_type: 'INSTAGRAM_DIRECT', is_dynamic_creative: false }
        : { call_to_action: { type: 'MESSAGE_PAGE' } }
    );

    const r = await createAd(mockClient, { ...baseOpts, skipMessagingDestinationCheck: true });

    expect(r.status).toBe('dry_run');
    expect(r.warnings?.join(' ')).toMatch(/messaging/i);
  });

  it('returns failed on error', async () => {
    const token = 'task8_create_ad_secret_123456789';
    mockMetaPost.mockRejectedValueOnce(
      new Error(`Ad failed: access_token=${token}; Authorization: Bearer ${token}`)
    );
    const r = await createAd(mockClient, baseOpts, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
    const json = JSON.stringify(r);
    expect(r.error).toContain('[REDACTED]');
    expect(r.structuredError?.message).toContain('[REDACTED]');
    expect(json).not.toContain(token);
    expect(json).not.toContain(`access_token=${token}`);
    expect(json).not.toContain(`Authorization: Bearer ${token}`);
  });
});
