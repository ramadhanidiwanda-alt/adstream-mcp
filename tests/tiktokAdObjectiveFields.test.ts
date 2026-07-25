import { describe, expect, it, vi } from 'vitest';
import { createTikTokAd } from '../src/tools/tiktok/createTikTokAd.js';
import type { TikTokApiClient } from '../src/tiktokClient.js';

function stubClient(): TikTokApiClient {
  return { post: vi.fn().mockResolvedValue({ ad_id: 'ad_1' }), get: vi.fn() } as unknown as TikTokApiClient;
}

describe('createTikTokAd objective-specific creative fields', () => {
  it('sends page_id for LEAD_GENERATION creatives', async () => {
    const client = stubClient();
    await createTikTokAd(client, {
      advertiserId: 'adv_1',
      adgroupId: 'ag_1',
      adName: 'Lead gen ad',
      creatives: [
        {
          creative_name: 'Lead gen creative',
          creative_material: {
            title: 'Sign up now',
            call_to_action: 'SIGN_UP',
            landing_page_url: 'https://example.com',
            video_id: 'v_1',
            page_id: '7000000000000000001',
          },
        },
      ],
    });

    const body = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body.creatives[0].creative_material.page_id).toBe('7000000000000000001');
  });

  it('sends product_specific_type, item_group_ids, sku_ids for PRODUCT_SALES creatives', async () => {
    const client = stubClient();
    await createTikTokAd(client, {
      advertiserId: 'adv_1',
      adgroupId: 'ag_1',
      adName: 'Catalog ad',
      creatives: [
        {
          creative_name: 'Catalog creative',
          creative_material: {
            title: 'Shop now',
            call_to_action: 'SHOP_NOW',
            landing_page_url: 'https://example.com',
            product_specific_type: 'ALL',
            item_group_ids: ['item_1', 'item_2'],
            sku_ids: ['sku_1'],
          },
        },
      ],
    });

    const body = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(body.creatives[0].creative_material.product_specific_type).toBe('ALL');
    expect(body.creatives[0].creative_material.item_group_ids).toEqual(['item_1', 'item_2']);
    expect(body.creatives[0].creative_material.sku_ids).toEqual(['sku_1']);
  });
});
