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

    const result = await createCpasCatalogCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });
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
      promoted_object: {
        product_catalog_id: 'catalog_1',
        smart_pse_enabled: false,
      },
    });
    expect(post.mock.calls[1][1]).toMatchObject({
      status: 'PAUSED',
      destination_type: 'UNDEFINED',
      promoted_object: {
        product_set_id: 'ps_1',
        custom_event_type: 'PURCHASE',
        variation: 'PRODUCT_SET_AND_OMNICHANNEL',
        smart_pse_enabled: false,
      },
    });
    expect(post.mock.calls[2][1]).toMatchObject({ product_set_id: 'ps_1' });
    expect(post.mock.calls[1][1].promoted_object).not.toHaveProperty('product_catalog_id');
    expect(post.mock.calls[2][1]).not.toHaveProperty('omnichannel_link_spec');
    expect(post.mock.calls[2][1]).not.toHaveProperty('applink_treatment');
  });
});
