import { describe, expect, it, vi } from 'vitest';
import { createCpasCatalogCampaignBundle } from '../src/tools/createCpasCatalogCampaignBundle.js';
import type { MetaClient } from '../src/metaClient.js';

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
    });
    expect(result.preview.adSet).toMatchObject({
      destination_type: 'CATALOG',
      promoted_object: { product_set_id: 'ps_1' },
    });
    expect(result.preview.creative).toMatchObject({
      product_set_id: 'ps_1',
      object_story_spec: { template_data: expect.any(Object) },
    });
    expect(result.preview.ad).toMatchObject({ status: 'PAUSED' });
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
    expect(post.mock.calls[1][1]).toMatchObject({
      status: 'PAUSED',
      destination_type: 'CATALOG',
      promoted_object: { product_set_id: 'ps_1' },
    });
    expect(post.mock.calls[2][1]).toMatchObject({ product_set_id: 'ps_1' });
  });
});
