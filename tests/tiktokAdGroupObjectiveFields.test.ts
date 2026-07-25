import { describe, expect, it, vi } from 'vitest';
import { createTikTokAdGroup } from '../src/tools/tiktok/createTikTokAdGroup.js';
import type { TikTokApiClient } from '../src/tiktokClient.js';

function stubClient(): TikTokApiClient {
  return { post: vi.fn().mockResolvedValue({ adgroup_id: 'ag_1' }), get: vi.fn() } as unknown as TikTokApiClient;
}

describe('createTikTokAdGroup objective-specific fields', () => {
  it('sends app_id and promotion_type for APP_PROMOTION', async () => {
    const client = stubClient();
    await createTikTokAdGroup(client, {
      advertiserId: 'adv_1',
      campaignId: 'camp_1',
      adgroupName: 'App installs',
      budgetMode: 'BUDGET_MODE_DAY',
      budget: 100,
      bidType: 'BID_TYPE_NO_BID',
      bidPrice: 0,
      optimizationGoal: 'APP_INSTALLS',
      billingEvent: 'IMPRESSIONS',
      placementType: 'PLACEMENT_TYPE_AUTO',
      appId: '1234567890',
      promotionType: 'APP_INSTALL',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/adgroup/create/',
      expect.objectContaining({ app_id: '1234567890', promotion_type: 'APP_INSTALL' })
    );
  });

  it('sends pixel_id and optimization_event for WEB_CONVERSIONS', async () => {
    const client = stubClient();
    await createTikTokAdGroup(client, {
      advertiserId: 'adv_1',
      campaignId: 'camp_1',
      adgroupName: 'Website conversions',
      budgetMode: 'BUDGET_MODE_DAY',
      budget: 100,
      bidType: 'BID_TYPE_NO_BID',
      bidPrice: 0,
      optimizationGoal: 'CONVERT',
      billingEvent: 'IMPRESSIONS',
      placementType: 'PLACEMENT_TYPE_AUTO',
      pixelId: 'pixel_1',
      optimizationEvent: 'COMPLETE_PAYMENT',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/adgroup/create/',
      expect.objectContaining({ pixel_id: 'pixel_1', optimization_event: 'COMPLETE_PAYMENT' })
    );
  });

  it('sends catalog_id, store_id, product_source for PRODUCT_SALES', async () => {
    const client = stubClient();
    await createTikTokAdGroup(client, {
      advertiserId: 'adv_1',
      campaignId: 'camp_1',
      adgroupName: 'Catalog sales',
      budgetMode: 'BUDGET_MODE_DAY',
      budget: 100,
      bidType: 'BID_TYPE_NO_BID',
      bidPrice: 0,
      optimizationGoal: 'VALUE',
      billingEvent: 'IMPRESSIONS',
      placementType: 'PLACEMENT_TYPE_AUTO',
      catalogId: 'cat_1',
      storeId: 'store_1',
      productSource: 'CATALOG',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/adgroup/create/',
      expect.objectContaining({ catalog_id: 'cat_1', store_id: 'store_1', product_source: 'CATALOG' })
    );
  });

  it('omits objective-specific fields when not supplied', async () => {
    const client = stubClient();
    await createTikTokAdGroup(client, {
      advertiserId: 'adv_1',
      campaignId: 'camp_1',
      adgroupName: 'Reach',
      budgetMode: 'BUDGET_MODE_DAY',
      budget: 100,
      bidType: 'BID_TYPE_NO_BID',
      bidPrice: 0,
      optimizationGoal: 'REACH',
      billingEvent: 'IMPRESSIONS',
      placementType: 'PLACEMENT_TYPE_AUTO',
    });

    const body = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body).not.toHaveProperty('app_id');
    expect(body).not.toHaveProperty('pixel_id');
    expect(body).not.toHaveProperty('catalog_id');
  });
});
