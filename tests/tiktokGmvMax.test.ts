import { describe, expect, it, vi } from 'vitest';
import { createGmvMaxCampaign } from '../src/tools/tiktok/createTikTokGmvMax.js';
import type { TikTokApiClient } from '../src/tiktokClient.js';

function stubClient(): TikTokApiClient {
  return {
    post: vi.fn().mockResolvedValue({ campaign_id: 'c_1' }),
    get: vi.fn(),
  } as unknown as TikTokApiClient;
}

describe('createGmvMaxCampaign shopping_ads_type', () => {
  it('sends shopping_ads_type PRODUCT with product fields', async () => {
    const client = stubClient();
    await createGmvMaxCampaign(client, {
      advertiserId: 'adv_1',
      campaignName: 'Product GMV Max',
      objectiveType: 'PRODUCT_SALES',
      storeIds: ['store_1'],
      shoppingAdsType: 'PRODUCT',
      productSpecificType: 'ALL',
      itemGroupIds: ['item_1'],
    });

    const body = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body.shopping_ads_type).toBe('PRODUCT');
    expect(body.product_specific_type).toBe('ALL');
    expect(body.item_group_ids).toEqual(['item_1']);
    expect(body).not.toHaveProperty('identity_list');
  });

  it('sends shopping_ads_type LIVE with identity_list', async () => {
    const client = stubClient();
    await createGmvMaxCampaign(client, {
      advertiserId: 'adv_1',
      campaignName: 'LIVE GMV Max',
      objectiveType: 'PRODUCT_SALES',
      storeIds: ['store_1'],
      shoppingAdsType: 'LIVE',
      identityList: ['identity_1'],
    });

    const body = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body.shopping_ads_type).toBe('LIVE');
    expect(body.identity_list).toEqual(['identity_1']);
    expect(body).not.toHaveProperty('product_specific_type');
    expect(body).not.toHaveProperty('item_group_ids');
  });
});
