import { describe, expect, it, vi } from 'vitest';
import { createEcommerceCampaignBundle } from '../src/tools/createEcommerceCampaignBundle.js';
import type { MetaClient } from '../src/metaClient.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

const payload = {
  adAccountId: 'act_123',
  campaignName: 'Sales - Prospecting - July',
  adSetName: 'Broad - Indonesia',
  adName: 'Hero Product - Static 1',
  pageId: '111222333',
  pixelId: '444555666',
  destinationUrl: 'https://example.com/products/hero',
  dailyBudget: 150000,
  currency: 'IDR',
  countries: ['ID'],
  primaryText: 'Discover our best-selling product today.',
  headline: 'Shop the Hero Product',
  description: 'Limited launch offer.',
  imageHash: 'abc123imagehash',
};

describe('createEcommerceCampaignBundle', () => {
  it('returns a dry-run preview without calling Meta POST', async () => {
    const client = createMockClient();

    const result = await createEcommerceCampaignBundle(client, payload, { dryRun: true });

    expect(result.executed).toBe(false);
    expect(result.status).toBe('dry_run');
    expect(client.metaPost).not.toHaveBeenCalled();
    expect(result.preview.campaign).toMatchObject({
      name: payload.campaignName,
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: [],
    });
    expect(result.preview.adSet).toMatchObject({
      name: payload.adSetName,
      status: 'PAUSED',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      billing_event: 'IMPRESSIONS',
      daily_budget: payload.dailyBudget,
    });
    expect(result.preview.ad).toMatchObject({ name: payload.adName, status: 'PAUSED' });
  });


  it('includes Instagram and Threads identities in creative preview', async () => {
    const client = createMockClient();

    const result = await createEcommerceCampaignBundle(client, {
      ...payload,
      instagramUserId: 'ig_123',
      threadsProfileId: 'threads_456',
    }, { dryRun: true });

    expect(result.preview.creative.object_story_spec).toMatchObject({
      page_id: payload.pageId,
      instagram_user_id: 'ig_123',
      threads_profile_id: 'threads_456',
    });
  });

  it('creates campaign, ad set, creative, and ad in order when confirmed', async () => {
    const client = createMockClient();
    const mockPost = client.metaPost as MetaPostMock;
    // 4 metaPost calls: campaign, adset, creative, ad
    mockPost
      .mockResolvedValueOnce({ id: 'cmp_1' })
      .mockResolvedValueOnce({ id: 'adset_1' })
      .mockResolvedValueOnce({ id: 'creative_1' })
      .mockResolvedValueOnce({ id: 'ad_1' });

    const result = await createEcommerceCampaignBundle(client, payload, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe('executed');
    expect(result.ids).toEqual({
      campaignId: 'cmp_1',
      adSetId: 'adset_1',
      creativeId: 'creative_1',
      adId: 'ad_1',
    });
    // Verify 4 API calls were made (campaign, adset, creative, ad)
    expect(mockPost).toHaveBeenCalledTimes(4);
    // Check first call is campaign creation
    expect(mockPost.mock.calls[0][0]).toContain('/campaigns');
    // Check second call is adset creation
    expect(mockPost.mock.calls[1][0]).toContain('/adsets');
    // Check third call is creative creation
    expect(mockPost.mock.calls[2][0]).toContain('/adcreatives');
    // Check fourth call is ad creation
    expect(mockPost.mock.calls[3][0]).toContain('/ads');
  });

  it('refuses execution without explicit confirmation', async () => {
    const client = createMockClient();

    const result = await createEcommerceCampaignBundle(client, payload, { dryRun: false });

    expect(result.executed).toBe(false);
    expect(result.status).toBe('pending_confirmation');
    expect(result.error).toContain('Explicit confirmation is required');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('validates required ecommerce launch fields safely', async () => {
    const client = createMockClient();

    await expect(
      createEcommerceCampaignBundle(client, { ...payload, pixelId: '' }, { dryRun: true })
    ).rejects.toThrow('pixelId is required');
  });
});
